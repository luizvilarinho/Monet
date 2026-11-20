// Linhas do SSE: acumula bytes e só decodifica linha completa, para um
// caractere multibyte cortado entre dois pacotes não virar U+FFFD.
#[derive(Default)]
pub(crate) struct SseLineBuffer {
    buf: Vec<u8>,
}

impl SseLineBuffer {
    pub(crate) fn push(&mut self, bytes: &[u8]) {
        self.buf.extend_from_slice(bytes)
    }

    pub(crate) fn next_line(&mut self) -> Option<String> {
        let pos = self.buf.iter().position(|&b| b == b'\n')?;
        let line: Vec<u8> = self.buf.drain(..=pos).collect();
        Some(String::from_utf8_lossy(&line[..line.len() - 1]).into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::SseLineBuffer;

    fn drain(buf: &mut SseLineBuffer) -> Vec<String> {
        let mut lines = Vec::new();
        while let Some(line) = buf.next_line() {
            lines.push(line);
        }
        lines
    }

    #[test]
    fn two_byte_char_split_between_pushes() {
        let mut buf = SseLineBuffer::default();
        buf.push(b"data: a\xC3");
        assert_eq!(buf.next_line(), None);
        buf.push(b"\xA7o\n");
        assert_eq!(drain(&mut buf), vec!["data: aço"]);
    }

    #[test]
    fn four_byte_emoji_split_in_three_pushes() {
        let emoji = "\u{1F600}".as_bytes();
        assert_eq!(emoji.len(), 4);
        let mut buf = SseLineBuffer::default();
        buf.push(&[b'x', emoji[0]]);
        buf.push(&emoji[1..3]);
        assert_eq!(buf.next_line(), None);
        let mut rest = emoji[3..].to_vec();
        rest.extend_from_slice(b"y\n");
        buf.push(&rest);
        assert_eq!(drain(&mut buf), vec!["x\u{1F600}y".to_string()]);
    }

    #[test]
    fn several_lines_in_one_packet() {
        let mut buf = SseLineBuffer::default();
        buf.push(b"data: 1\n\ndata: 2\n: comment\n");
        assert_eq!(drain(&mut buf), vec!["data: 1", "", "data: 2", ": comment"]);
    }

    #[test]
    fn line_without_newline_waits_for_the_rest() {
        let mut buf = SseLineBuffer::default();
        buf.push(b"data: {\"con");
        assert_eq!(buf.next_line(), None);
        buf.push(b"tent\":\"x\"}");
        assert_eq!(buf.next_line(), None);
        buf.push(b"\ndata: next");
        assert_eq!(drain(&mut buf), vec!["data: {\"content\":\"x\"}"]);
        buf.push(b"\n");
        assert_eq!(drain(&mut buf), vec!["data: next"]);
    }

    #[test]
    fn crlf_keeps_carriage_return_for_the_caller_to_trim() {
        let mut buf = SseLineBuffer::default();
        buf.push(b"data: [DONE]\r\n");
        let line = buf.next_line().unwrap();
        assert_eq!(line, "data: [DONE]\r");
        assert_eq!(line.trim(), "data: [DONE]");
    }

    #[test]
    fn json_with_multibyte_round_trips() {
        let src = "data: {\"content\":\"ã\"}";
        let bytes = src.as_bytes();
        // Corta no meio do "ã" (0xC3 0xA3).
        let cut = src.find('ã').unwrap() + 1;
        let mut buf = SseLineBuffer::default();
        buf.push(&bytes[..cut]);
        buf.push(&bytes[cut..]);
        buf.push(b"\n");
        assert_eq!(drain(&mut buf), vec![src.to_string()]);
    }
}
