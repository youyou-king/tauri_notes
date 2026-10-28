//! Markdown 的“块级”切分器。
//!
//! 这一层刻意不依赖 Bevy：输入是 `&str`，输出是若干字节区间 + 块类型。
//! 好处是可以用普通单元测试快速验证规则，而不是每改一次规则都去启动窗口。
//!
//! # 为什么用字节区间而不是“第几个字符”
//!
//! Rust 的 `String` 只能按字节切片。中文一个字通常占 3 个 UTF-8 字节，
//! 如果按 `char` 下标存区间，`&source[range]` 会直接 panic 或切在半个汉字上。
//! 因此 `BlockSpec::range` 始终是**合法 UTF-8 边界上的字节区间**。
//!
//! # 本阶段的切分规则
//!
//! 1. 空行是块边界。
//! 2. 连续列表行合并为一个块。
//! 3. 代码围栏内部即使有空行也不切分，整个围栏是一个块。
//! 4. 标题、引用、表格、分隔线各自成块；普通段落允许跨多行。
//!
//! 第 4 条是对需求文档的补充：文档只写了“空行 + 块级起始标记”，
//! 但没有定义“标题下面紧跟着正文”这种情况。若只按空行切，
//! `# 标题\n正文` 会变成一个块，渲染时就会把标题和正文混在一起。
//! 因此这里把“块级起始标记的变化”也视为边界。

use std::ops::Range;

/// 一个块的语义类型。
///
/// `Code` 暂时不记录语言；渲染阶段会从围栏第一行再解析一次，
/// 这样 `BlockKind` 保持 `Copy`，组件读写也更便宜。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlockKind {
    Heading(u8),
    Paragraph,
    List { ordered: bool, start: u64 },
    Quote,
    Code,
    Table,
    Rule,
}

/// 一个块的元数据。
///
/// `range` 指向 `DocumentSource` 中的源码片段，**不含**分隔空行与行尾换行。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BlockSpec {
    pub range: Range<usize>,
    pub kind: BlockKind,
}

impl BlockSpec {
    /// 安全地取出该块对应的源码。
    #[cfg(test)]
    pub fn source<'a>(&self, source: &'a str) -> &'a str {
        &source[self.range.clone()]
    }
}

/// 扫描出所有物理行，并记录它们在源码中的字节区间。
///
/// 行尾的 `\n` 与 `\r\n` 不计入 `end`，这样块源码不会带一个看不见的换行，
/// 渲染和编辑回写都更干净。
#[derive(Clone, Copy, Debug)]
struct Line {
    start: usize,
    end: usize,
}

impl Line {
    fn text<'a>(&self, source: &'a str) -> &'a str {
        &source[self.start..self.end]
    }

    fn is_blank(&self, source: &str) -> bool {
        self.text(source).trim().is_empty()
    }
}

fn scan_lines(source: &str) -> Vec<Line> {
    let mut lines = Vec::new();
    let bytes = source.as_bytes();
    let mut start = 0usize;

    for i in 0..=bytes.len() {
        // 条件 `i == bytes.len()` 处理最后一行没有换行符的情况。
        if i == bytes.len() || bytes[i] == b'\n' {
            let mut end = i;
            if end > start && bytes[end - 1] == b'\r' {
                end -= 1;
            }
            lines.push(Line { start, end });
            start = i + 1;
        }
    }

    lines
}

/// 围栏的开始：``` 或 ~~~，至少 3 个字符。
/// 返回 (围栏字符, 长度, 信息字符串)。
fn fence_open(text: &str) -> Option<(u8, usize, &str)> {
    let trimmed = text.trim_start();
    let first = *trimmed.as_bytes().first()?;
    if first != b'`' && first != b'~' {
        return None;
    }

    let fence_len = trimmed.bytes().take_while(|b| *b == first).count();
    if fence_len < 3 {
        return None;
    }

    Some((first, fence_len, trimmed[fence_len..].trim()))
}

/// 是否是某个围栏的结束行。
fn fence_close(text: &str, fence_char: u8, fence_len: usize) -> bool {
    let trimmed = text.trim_start();
    let count = trimmed.bytes().take_while(|b| *b == fence_char).count();
    count >= fence_len && trimmed[count..].trim().is_empty()
}

/// 行首缩进（只数空格；制表符按 4 个空格估算）。
fn indent_len(text: &str) -> usize {
    let mut indent = 0;
    for ch in text.chars() {
        match ch {
            ' ' => indent += 1,
            '\t' => indent += 4,
            _ => break,
        }
        // 超过 3 个空格已经不是“块级标记”的合法缩进了。
        if indent > 3 {
            break;
        }
    }
    indent
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LineKind {
    Heading(u8),
    List { ordered: bool, start: u64 },
    Quote,
    Table,
    Rule,
    Text,
}

fn is_rule(text: &str) -> bool {
    let t = text.trim();
    if t.len() < 3 {
        return false;
    }

    let first = t.as_bytes()[0];
    if !matches!(first, b'-' | b'*' | b'_') {
        return false;
    }

    t.bytes().all(|b| b == first || b == b' ')
}

/// 解析列表标记。返回 (是否有序, 起始编号, 正文起点在原文中的字节偏移)。
fn list_marker(text: &str) -> Option<(bool, u64, usize)> {
    let bytes = text.as_bytes();

    // 无序列表：`- item` / `* item` / `+ item`，标记后必须是空白。
    if bytes.len() >= 2 && matches!(bytes[0], b'-' | b'*' | b'+') {
        if bytes[1] == b' ' || bytes[1] == b'\t' {
            return Some((false, 1, 2));
        }
    }

    // 有序列表：`1. item` / `1) item`。
    let digits = bytes.iter().take_while(|b| b.is_ascii_digit()).count();
    if (1..=9).contains(&digits) && digits + 1 < bytes.len() {
        let punct = bytes[digits];
        if matches!(punct, b'.' | b')') {
            let after = bytes[digits + 1];
            if after == b' ' || after == b'\t' {
                let start = text[..digits].parse::<u64>().unwrap_or(1);
                return Some((true, start, digits + 2));
            }
        }
    }

    None
}

fn classify(text: &str) -> LineKind {
    let indent = indent_len(text);
    let t = text.trim_start();
    if t.is_empty() {
        return LineKind::Text;
    }

    // 超过 3 个空格的块级标记只有嵌套列表仍然合法。
    // 其他标记（标题、引用、表格、分隔线）按普通文本处理。
    if indent > 3 {
        if let Some((ordered, start, _)) = list_marker(t) {
            return LineKind::List { ordered, start };
        }
        return LineKind::Text;
    }

    // ATX 标题：1~6 个 `#`，后面必须是空白或行尾。
    let hashes = t.bytes().take_while(|b| *b == b'#').count();
    if (1..=6).contains(&hashes) {
        let rest = &t[hashes..];
        if rest.is_empty() || rest.starts_with(' ') || rest.starts_with('\t') {
            return LineKind::Heading(hashes as u8);
        }
    }

    // 分隔线要放在列表判断前面：`---` 不是列表项。
    if is_rule(t) {
        return LineKind::Rule;
    }

    if t.starts_with('>') {
        return LineKind::Quote;
    }

    if t.starts_with('|') {
        return LineKind::Table;
    }

    if let Some((ordered, start, _)) = list_marker(t) {
        return LineKind::List { ordered, start };
    }

    LineKind::Text
}

fn flush(current: &mut Option<(usize, usize, BlockKind)>, blocks: &mut Vec<BlockSpec>) {
    if let Some((start, end, kind)) = current.take() {
        blocks.push(BlockSpec {
            range: start..end,
            kind,
        });
    }
}

/// 把一个 Markdown 文档切成块。
///
/// 返回的区间互不重叠、按文档顺序排列，并且每个区间都是合法的 UTF-8 切片。
pub fn split_into_blocks(source: &str) -> Vec<BlockSpec> {
    let lines = scan_lines(source);
    let mut blocks = Vec::new();
    let mut current: Option<(usize, usize, BlockKind)> = None;
    let mut i = 0usize;

    while i < lines.len() {
        let line = lines[i];
        let text = line.text(source);

        if line.is_blank(source) {
            flush(&mut current, &mut blocks);
            i += 1;
            continue;
        }

        // 代码围栏必须整体吞掉，内部空行不切分。
        if let Some((fence_char, fence_len, _info)) = fence_open(text) {
            flush(&mut current, &mut blocks);

            let start = line.start;
            let mut end = line.end;
            let mut j = i + 1;

            while j < lines.len() {
                let t = lines[j].text(source);
                end = lines[j].end;
                if fence_close(t, fence_char, fence_len) {
                    j += 1;
                    break;
                }
                j += 1;
            }

            blocks.push(BlockSpec {
                range: start..end,
                kind: BlockKind::Code,
            });
            i = j;
            continue;
        }

        match classify(text) {
            LineKind::Heading(level) => {
                // 标题天然是单行块；下一行即使不是空行，也要另起一个块。
                flush(&mut current, &mut blocks);
                blocks.push(BlockSpec {
                    range: line.start..line.end,
                    kind: BlockKind::Heading(level),
                });
            }
            LineKind::List { ordered, start } => {
                let same_list = matches!(
                    current,
                    Some((_, _, BlockKind::List { ordered: current_ordered, .. }))
                        if current_ordered == ordered
                );

                if same_list {
                    current.as_mut().unwrap().1 = line.end;
                } else {
                    flush(&mut current, &mut blocks);
                    current = Some((line.start, line.end, BlockKind::List { ordered, start }));
                }
            }
            LineKind::Quote => {
                if matches!(current, Some((_, _, BlockKind::Quote))) {
                    current.as_mut().unwrap().1 = line.end;
                } else {
                    flush(&mut current, &mut blocks);
                    current = Some((line.start, line.end, BlockKind::Quote));
                }
            }
            LineKind::Table => {
                if matches!(current, Some((_, _, BlockKind::Table))) {
                    current.as_mut().unwrap().1 = line.end;
                } else {
                    flush(&mut current, &mut blocks);
                    current = Some((line.start, line.end, BlockKind::Table));
                }
            }
            LineKind::Rule => {
                flush(&mut current, &mut blocks);
                blocks.push(BlockSpec {
                    range: line.start..line.end,
                    kind: BlockKind::Rule,
                });
            }
            LineKind::Text => {
                // 普通段落允许跨行；只有遇到空行或别的块级标记才结束。
                if matches!(current, Some((_, _, BlockKind::Paragraph))) {
                    current.as_mut().unwrap().1 = line.end;
                } else {
                    flush(&mut current, &mut blocks);
                    current = Some((line.start, line.end, BlockKind::Paragraph));
                }
            }
        }

        i += 1;
    }

    flush(&mut current, &mut blocks);
    blocks
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slices<'a>(source: &'a str, blocks: &[BlockSpec]) -> Vec<&'a str> {
        blocks.iter().map(|b| &source[b.range.clone()]).collect()
    }

    #[test]
    fn splits_requirement_example_into_four_blocks() {
        let source = "# 标题\n\n这是第一段。\n\n- 列表项 1\n- 列表项 2\n\n> 引用\n";
        let blocks = split_into_blocks(source);

        assert_eq!(
            slices(source, &blocks),
            vec!["# 标题", "这是第一段。", "- 列表项 1\n- 列表项 2", "> 引用"]
        );
        assert_eq!(
            blocks.iter().map(|b| b.kind).collect::<Vec<_>>(),
            vec![
                BlockKind::Heading(1),
                BlockKind::Paragraph,
                BlockKind::List {
                    ordered: false,
                    start: 1
                },
                BlockKind::Quote,
            ]
        );
    }

    #[test]
    fn keeps_blank_lines_inside_code_fence() {
        let source = "```rust\nfn main() {\n\n    println!(\"hi\");\n}\n```\n\n后文\n";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].kind, BlockKind::Code);
        assert!(blocks[0].source(source).contains("\n\n"));
        assert_eq!(blocks[1].source(source), "后文");
    }

    #[test]
    fn heading_ends_previous_paragraph_without_blank_line() {
        let source = "# 标题\n正文第一行\n正文第二行\n## 二级标题\n";
        let blocks = split_into_blocks(source);

        assert_eq!(
            slices(source, &blocks),
            vec!["# 标题", "正文第一行\n正文第二行", "## 二级标题"]
        );
        assert_eq!(
            blocks.iter().map(|b| b.kind).collect::<Vec<_>>(),
            vec![
                BlockKind::Heading(1),
                BlockKind::Paragraph,
                BlockKind::Heading(2)
            ]
        );
    }

    #[test]
    fn separates_two_lists_only_when_blank_line_appears() {
        let source = "- a\n- b\n\n- c\n";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].source(source), "- a\n- b");
        assert_eq!(blocks[1].source(source), "- c");
    }

    #[test]
    fn handles_crlf_and_keeps_ranges_valid() {
        let source = "# 标题\r\n\r\n段落\r\n";
        let blocks = split_into_blocks(source);

        assert_eq!(slices(source, &blocks), vec!["# 标题", "段落"]);
    }

    #[test]
    fn ranges_are_byte_offsets_not_char_indices() {
        let source = "你好\n\n世界";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 2);
        assert_eq!(&source[blocks[0].range.clone()], "你好");
        assert_eq!(&source[blocks[1].range.clone()], "世界");
        // “你好”是 6 个 UTF-8 字节，而不是 2 个 char。
        assert_eq!(blocks[0].range.end - blocks[0].range.start, 6);
    }

    #[test]
    fn empty_input_has_no_blocks() {
        assert!(split_into_blocks("").is_empty());
        assert!(split_into_blocks("\n\n  \n").is_empty());
    }

    #[test]
    fn ordered_list_keeps_start_number() {
        let source = "3. three\n4. four\n";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 1);
        assert_eq!(
            blocks[0].kind,
            BlockKind::List {
                ordered: true,
                start: 3
            }
        );
    }

    #[test]
    fn table_and_rule_are_separate_block_kinds() {
        let source = "| a | b |\n| - | - |\n\n---\n";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].kind, BlockKind::Table);
        assert_eq!(blocks[1].kind, BlockKind::Rule);
    }

    #[test]
    fn keeps_three_level_nested_list_in_one_block() {
        let source = "- a\n  - b\n    - c\n";
        let blocks = split_into_blocks(source);

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].source(source), "- a\n  - b\n    - c");
    }
}
