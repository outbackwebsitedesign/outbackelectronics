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
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(<li key={i}>{inlineRender(lines[i].replace(/^\d+\. /, ''))}</li>); i++; }
      nodes.push(<ol key={`ol-${i}`} style={{paddingLeft:22, margin:'8px 0 14px'}}>{items}</ol>);
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

// Plain-text excerpt of markdown, for card blurbs / meta descriptions.
export function excerptMarkdown(md, maxLen = 160) {
  if (!md) return '';
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…' : text;
}
