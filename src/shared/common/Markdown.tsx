import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

type Props = {
  content: string;
};

// Lightweight Markdown renderer for headings, lists, and basic inline styles
export default function Markdown({ content }: Props) {
  const blocks = useMemo(() => tokenize(content || ""), [content]);
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === "codeblock") {
          return (
            <View key={i} style={styles.codeBlock}>
              <Text style={styles.codeText}>{b.text}</Text>
            </View>
          );
        }
        if (b.type === "heading") {
          const style =
            b.level === 1
              ? styles.h1
              : b.level === 2
              ? styles.h2
              : b.level === 3
              ? styles.h3
              : b.level === 4
              ? styles.h4
              : b.level === 5
              ? styles.h5
              : styles.h6;
          return (
            <Text key={i} style={style}>
              {renderInline(b.text)}
            </Text>
          );
        }
        if (b.type === "ul") {
          return (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.p}>{renderInline(b.text)}</Text>
            </View>
          );
        }
        if (b.type === "ol") {
          return (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{b.index ?? 1}.</Text>
              <Text style={styles.p}>{renderInline(b.text)}</Text>
            </View>
          );
        }
        // paragraph
        return (
          <Text key={i} style={styles.p}>
            {renderInline(b.text)}
          </Text>
        );
      })}
    </View>
  );
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; text: string }
  | { type: "ol"; text: string; index: number }
  | { type: "codeblock"; text: string }
  | { type: "p"; text: string };

function tokenize(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const out: Block[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let olIndex = 1;

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (/^```/.test(line)) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        out.push({ type: "codeblock", text: codeLines.join("\n") });
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(raw);
      continue;
    }

    // headings
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      out.push({ type: "heading", level: m[1].length, text: m[2] });
      olIndex = 1;
      continue;
    }
    // ordered list
    const om = line.match(/^(\d+)\.\s+(.*)$/);
    if (om) {
      const idx = parseInt(om[1], 10);
      out.push({ type: "ol", text: om[2], index: idx });
      olIndex = idx + 1;
      continue;
    }
    // unordered list
    const um = line.match(/^[-*]\s+(.*)$/);
    if (um) {
      out.push({ type: "ul", text: um[1] });
      continue;
    }
    // empty line → spacer paragraph
    if (!line.trim()) {
      out.push({ type: "p", text: "" });
      continue;
    }
    out.push({ type: "p", text: line });
  }

  if (inCode) {
    out.push({ type: "codeblock", text: codeLines.join("\n") });
  }
  return out;
}

// Basic inline renderer for **bold**, *italic*, `code`
function renderInline(text: string) {
  if (!text) return text;
  // Tokenize bold first, then italic, then code
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  const pushText = (t: string) => {
    if (!t) return;
    nodes.push(<Text key={`t-${key++}`}>{t}</Text>);
  };

  // Split by code spans `code`
  const codeParts = rest.split(/(`[^`]+`)/g);
  codeParts.forEach((part, i) => {
    const isCode = /^`[^`]+`$/.test(part);
    if (isCode) {
      nodes.push(
        <Text key={`code-${key++}`} style={styles.codeInline}>
          {part.slice(1, -1)}
        </Text>
      );
      return;
    }
    // within non-code, handle bold and italic
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((bp) => {
      const isBold = /^\*\*[^*]+\*\*$/.test(bp);
      if (isBold) {
        nodes.push(
          <Text key={`b-${key++}`} style={styles.bold}>
            {bp.slice(2, -2)}
          </Text>
        );
        return;
      }
      const italicParts = bp.split(/(\*[^*]+\*)/g);
      italicParts.forEach((ip) => {
        const isItalic = /^\*[^*]+\*$/.test(ip);
        if (isItalic) {
          nodes.push(
            <Text key={`i-${key++}`} style={styles.italic}>
              {ip.slice(1, -1)}
            </Text>
          );
        } else if (ip) {
          pushText(ip);
        }
      });
    });
  });

  return nodes;
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 4,
  },
  h3: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 4,
  },
  h4: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 4,
  },
  h5: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 6,
    marginBottom: 2,
  },
  h6: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 6,
    marginBottom: 2,
  },
  p: {
    fontSize: 16,
    color: "#334155",
    lineHeight: 26,
    marginBottom: 2,
    flexShrink: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  bullet: {
    width: 16,
    fontSize: 16,
    color: "#334155",
    lineHeight: 26,
    textAlign: "right",
  },
  codeBlock: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  codeText: {
    fontSize: 14,
    color: "#E5E7EB",
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    lineHeight: 20,
  },
  codeInline: {
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  bold: { fontWeight: "800", color: "#0F172A" },
  italic: { fontStyle: "italic", color: "#0F172A" },
});
