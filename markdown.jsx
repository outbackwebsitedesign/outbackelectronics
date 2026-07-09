import React from 'react';

// Small hand-rolled markdown-subset renderer shared by the public tutorials
// page and the admin tutorial editor's live preview, so what staff see while
// writing is exactly what gets published.
export function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split('\n');
  const nodes = [];
  let i = 0;

  const inlineRender = (text) => {
    const parts = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[([^\]]+)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\))/g;
    let last = 0, m;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('![')) {
        parts.push(<img key={m.index} src={m[5]} alt={m[4]} style={{maxWidth:'100%', margin:'8px 0', display:'block'}} />);
      } else if (t.startsWith('[')) {
        const href = /^javascript:/i.test(m[3]) ? '#' : m[3];
        parts.push(<a key={m.index} href={href} style={{color:'var(--rust)'}} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
      } else if (t.startsWith('**')) {
        parts.push(<strong key={m.index}>{t.slice(2,-2)}</strong>);
      } else if (t.startsWith('_')) {
        parts.push(<em key={m.index}>{t.slice(1,-1)}</em>);
      } else {
        parts.push(<code key={m.index} style={{background:'var(--bg-elev)', padding:'1px 5px', fontFamily:'monospace', fontSize:'0.9em'}}>{t.slice(1,-1)}</code>);
      }
      last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={i} style={{background:'var(--bg-elev)', padding:'14px 18px', overflowX:'auto', fontSize:13, lineHeight:1.55, margin:'16px 0'}}><code>{codeLines.join('\n')}</code></pre>);
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{fontFamily:'Instrument Serif, serif', fontSize:26, marginTop:28, marginBottom:6, lineHeight:1.15}}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} style={{fontFamily:'Instrument Serif, serif', fontSize:21, marginTop:22, marginBottom:4, lineHeight:1.2}}>{line.slice(4)}</h3>);
    } else if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(<li key={i}>{inlineRender(lines[i].slice(2))}</li>); i++; }
      nodes.push(<ul key={`ul-${i}`} style={{paddingLeft:22, margin:'8px 0 14px'}}>{items}</ul>);
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items = [];
      // A numbered line that's isolated from its siblings by prose (common in
      // numbered section headers like "1. Intro" ... prose ... "2. Details")
      // becomes its own single-item <ol> — respect the author's own number
      // instead of letting a fresh list default back to 1 every time.
      const startNum = parseInt(line.match(/^(\d+)\./)[1], 10) || 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(<li key={i}>{inlineRender(lines[i].replace(/^\d+\. /, ''))}</li>); i++; }
      nodes.push(<ol key={`ol-${i}`} start={startNum} style={{paddingLeft:22, margin:'8px 0 14px'}}>{items}</ol>);
      continue;
    } else if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i+1])) {
      const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headerCells = splitRow(line);
      const align = splitRow(lines[i+1]).map(c => {
        const left = c.startsWith(':'), right = c.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
      });
      i += 2;
      const bodyRows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { bodyRows.push(splitRow(lines[i])); i++; }
      nodes.push(
        <div key={`table-${i}`} style={{overflowX:'auto', margin:'16px 0'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
            <thead>
              <tr>
                {headerCells.map((c,ci) => (
                  <th key={ci} style={{textAlign:align[ci]||'left', padding:'8px 12px', borderBottom:'2px solid var(--ink)', fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink-2)', whiteSpace:'nowrap'}}>{inlineRender(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row,ri) => (
                <tr key={ri} style={{borderBottom:'1px solid var(--line)'}}>
                  {row.map((c,ci) => <td key={ci} style={{textAlign:align[ci]||'left', padding:'8px 12px', verticalAlign:'top'}}>{inlineRender(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (line.trim() === '') {
      nodes.push(<div key={i} style={{height:10}} />);
    } else {
      nodes.push(<p key={i} style={{margin:'0 0 10px', lineHeight:1.75}}>{inlineRender(line)}</p>);
    }
    i++;
  }
  return nodes;
}

function stripMarkdown(md) {
  return (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Plain-text excerpt of markdown, for card blurbs / meta descriptions.
export function excerptMarkdown(md, maxLen = 160) {
  if (!md) return '';
  const text = stripMarkdown(md);
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…' : text;
}

// Reading-time estimate at 200 words/minute, rounded up, minimum 1 minute.
export function estimateReadTime(...markdownParts) {
  const words = stripMarkdown(markdownParts.filter(Boolean).join(' ')).split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}
