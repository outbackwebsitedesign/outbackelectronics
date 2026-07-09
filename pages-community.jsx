import React, { useState, useEffect } from 'react';
import { renderMarkdown, excerptMarkdown, slugify } from './markdown.jsx';

// A tutorial's first non-empty prose, used as a card blurb / meta fallback
// when staff haven't written an explicit description.
function tutorialExcerpt(t) {
  if (t.description) return t.description;
  if (t.format === 'steps') return excerptMarkdown(t.intro || (t.steps && t.steps[0] && t.steps[0].body) || '');
  return excerptMarkdown(t.body || '');
}

// ============================================================
// TUTORIALS
// ============================================================
const tutorialHref = (t) => `/tutorial/${encodeURIComponent(t.slug || t.id)}`;
const tutorialLinkProps = (t, go) => ({
  href: tutorialHref(t),
  onClick: (e) => { e.preventDefault(); go('tutorial', t); },
});

// All published tutorials sharing a series name, in part order.
const seriesPartsOf = (seriesName, allTutorials) =>
  allTutorials.filter(t => t.series === seriesName).sort((a,b) => (Number(a.seriesOrder)||0) - (Number(b.seriesOrder)||0));

const seriesHref = (seriesName) => `/tutorials/series/${encodeURIComponent(slugify(seriesName))}`;
// Navigate to the series page with a fully-resolved parts list already in
// hand (from a page that already fetched all tutorials), so there's no
// loading flicker — matches how product/service cards pass go() full data.
const seriesLinkProps = (seriesName, allTutorials, go) => ({
  href: seriesHref(seriesName),
  onClick: (e) => { e.preventDefault(); go('tutorial-series', { seriesName, slug: slugify(seriesName), parts: seriesPartsOf(seriesName, allTutorials) }); },
});

function TutorialsPage({ go }) {
  const [filter, setFilter] = useState('All');
  const [seriesFilter, setSeriesFilter] = useState('All');
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // The server already returns only Published tutorials (and strips the
    // body of locked ones) — no client-side status filtering needed here.
    fetch('/api/tutorials').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      setTutorials(d.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build category list from data, plus 'All'
  const cats = ['All', ...Array.from(new Set(tutorials.map(t => t.cat).filter(Boolean)))];
  const seriesNames = Array.from(new Set(tutorials.map(t => t.series).filter(Boolean))).sort();

  const list = tutorials
    .filter(t => filter === 'All' || t.cat === filter)
    .filter(t => seriesFilter === 'All' || t.series === seriesFilter);

  return (
    <>
      <PageHead crumbs={['Outback','Tutorials']} title="Tutorials &amp; Guides"
        lead="Step-by-step guides, video walkthroughs, and bench notes from the workshop." />
      <section className="container" style={{paddingTop: 32, paddingBottom: 48}}>

        {/* Category filters */}
        <div className="tabs" style={{marginBottom: seriesNames.length ? 10 : 24}} role="group" aria-label="Filter tutorials by category">
          {cats.map(c => (
            <div key={c} className={`tab ${filter===c?'active':''}`} role="button" tabIndex={0} aria-pressed={filter===c}
              onClick={() => setFilter(c)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(c); } }}>{c}</div>
          ))}
        </div>

        {/* Series filters — only shown once at least one tutorial belongs to a series */}
        {seriesNames.length > 0 && (
          <div className="tabs" style={{marginBottom: 24}} role="group" aria-label="Filter tutorials by series">
            {['All', ...seriesNames].map(s => (
              <div key={s} className={`tab ${seriesFilter===s?'active':''}`} role="button" tabIndex={0} aria-pressed={seriesFilter===s}
                onClick={() => setSeriesFilter(s)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSeriesFilter(s); } }}>{s === 'All' ? 'All series' : s}</div>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{height:200, background:'var(--bg-elev)', animation:'pulse 1.4s ease-in-out infinite', opacity:0.5}} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <div style={{padding:'48px 0'}}>
            <p className="serif" style={{fontSize:28, marginBottom:12}}>Writing up the first ones now.</p>
            <p style={{color:'var(--ink-2)', fontSize:15, maxWidth:520, lineHeight:1.7}}>
              We have plenty of hard-won knowledge from years of field repairs — we're just getting it out of our heads and onto the page. Check back soon.
            </p>
          </div>
        )}

        {/* Tutorial grid */}
        {!loading && list.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {list.map((t, i) => (
              <div key={t.id||i} className="card-paper" style={{display:'flex', flexDirection:'column', overflow:'hidden', opacity: t.locked ? 0.8 : 1}}>
                {t.coverImage && (
                  <div style={{aspectRatio:'16/9', overflow:'hidden', background:'var(--bg-elev)'}}>
                    <img src={t.coverImage} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  </div>
                )}
                <div style={{padding:'20px 24px 0'}}>
                  <div className="row-flex" style={{gap:6, flexWrap:'wrap'}}>
                    {t.locked && <span className="tag tag-rust" style={{marginBottom:8, display:'inline-block'}}>MEMBERS ONLY</span>}
                    {!t.locked && t.cat && <span className="tag tag-outline" style={{marginBottom:10, display:'inline-block'}}>{t.cat.toUpperCase()}</span>}
                    {t.format === 'steps' && <span className="tag tag-outline" style={{marginBottom:10, display:'inline-block'}}>{(t.steps||[]).length} STEPS</span>}
                    {t.series && (
                      <a {...seriesLinkProps(t.series, tutorials, go)} className="tag tag-rust" style={{marginBottom:10, display:'inline-block', textDecoration:'none'}}>
                        {t.series.toUpperCase()} · PART {t.seriesOrder||1}
                      </a>
                    )}
                  </div>
                  <a {...tutorialLinkProps(t, go)} style={{textDecoration:'none', color:'inherit'}}>
                    <h3 className="serif" style={{fontSize:22, lineHeight:1.15, marginTop:6}}>{t.title}</h3>
                  </a>
                  <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)', lineHeight:1.6,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                    {tutorialExcerpt(t)}
                  </p>
                </div>
                <div style={{padding:'16px 24px 20px', marginTop:'auto'}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginBottom:10}}>
                    {[t.difficulty, t.duration].filter(Boolean).join(' · ')}
                  </div>
                  {t.locked
                    ? <a href="/memberships" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}} onClick={e=>{e.preventDefault(); go('memberships');}}>Join to unlock →</a>
                    : <a {...tutorialLinkProps(t, go)} className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>Read More →</a>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Format-aware body: video embed, then either numbered steps (with tools list
// and intro) or a single markdown article. Shared by the tutorial detail page.
function TutorialContent({ tutorial }) {
  return (
    <>
      {tutorial.videoUrl && (
        <div style={{position:'relative', paddingTop:'56.25%', marginBottom:28, background:'#000'}}>
          <iframe
            src={tutorial.videoUrl}
            style={{position:'absolute', inset:0, width:'100%', height:'100%', border:0}}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={tutorial.title}
          />
        </div>
      )}

      {tutorial.format === 'steps' ? (
        <>
          {tutorial.intro && (
            <div style={{fontSize:15, color:'var(--ink)', lineHeight:1.75, marginBottom:8}}>{renderMarkdown(tutorial.intro)}</div>
          )}
          {(tutorial.tools||[]).length > 0 && (
            <div style={{background:'var(--bg-elev)', padding:'16px 20px', margin:'8px 0 24px'}}>
              <div className="eyebrow" style={{marginBottom:8}}>WHAT YOU'LL NEED</div>
              <ul style={{paddingLeft:20, margin:0, fontSize:14, lineHeight:1.8}}>
                {tutorial.tools.map((tool,ti) => <li key={ti}>{tool}</li>)}
              </ul>
            </div>
          )}
          {(tutorial.steps||[]).length > 0 ? (
            <ol style={{listStyle:'none', margin:0, padding:0}}>
              {tutorial.steps.map((s,si) => (
                <li key={s.id||si} style={{marginBottom:32, paddingBottom:32, borderBottom: si < tutorial.steps.length-1 ? '1px solid var(--line)' : 'none'}}>
                  <div className="row-flex" style={{alignItems:'flex-start', gap:14}}>
                    <span className="mono" style={{fontSize:13, color:'var(--paper)', background:'var(--rust)', width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center', flexShrink:0}}>{si+1}</span>
                    <div style={{flex:1, minWidth:0}}>
                      <h2 style={{fontFamily:'Instrument Serif, serif', fontSize:22, lineHeight:1.2, margin:'2px 0 8px'}}>{s.title}</h2>
                      {s.image && <img src={s.image} alt="" style={{width:'100%', maxHeight:320, objectFit:'cover', margin:'8px 0'}} />}
                      <div style={{fontSize:15, color:'var(--ink)', lineHeight:1.75}}>{renderMarkdown(s.body)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{color:'var(--ink-2)', fontSize:14}}>No steps added yet.</p>
          )}
        </>
      ) : tutorial.body ? (
        <div style={{fontSize:15, color:'var(--ink)', lineHeight:1.75}}>
          {renderMarkdown(tutorial.body)}
        </div>
      ) : (
        <p style={{color:'var(--ink-2)', fontSize:14}}>No content available for this tutorial yet.</p>
      )}

      {(tutorial.tags||[]).length > 0 && (
        <div className="row-flex" style={{gap:6, flexWrap:'wrap', marginTop:28}}>
          {tutorial.tags.map((tag,ti) => <span key={ti} className="tag tag-outline">{tag}</span>)}
        </div>
      )}
    </>
  );
}

// Single tutorial at its own URL (/tutorial/:slug), resolved via pageParams
// by app.jsx's deep-link handling — see resolveDeepLink().
function TutorialPage({ go, pageParams }) {
  const tutorial = pageParams;
  const countedRef = React.useRef(null);
  const [seriesParts, setSeriesParts] = useState([]);

  // Count one view per tutorial visit — fire-and-forget, and guarded so it
  // doesn't double-count on re-renders once the deep link has resolved.
  useEffect(() => {
    if (!tutorial || tutorial._notFound || countedRef.current === tutorial.id) return;
    countedRef.current = tutorial.id;
    fetch('/api/tutorials/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tutorial.id }),
      keepalive: true,
    }).catch(() => {});
  }, [tutorial]);

  // Fetch sibling parts so the series box and prev/next links can render.
  useEffect(() => {
    if (!tutorial || tutorial._notFound || !tutorial.series) { setSeriesParts([]); return; }
    fetch('/api/tutorials').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      setSeriesParts(seriesPartsOf(tutorial.series, d.items || []));
    }).catch(() => {});
  }, [tutorial && tutorial.series]);

  if (!tutorial) {
    return (
      <>
        <PageHead crumbs={['Outback','Tutorials','Loading…']} title="Loading…" />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <div style={{maxWidth:760, margin:'0 auto', display:'grid', gap:14}}>
            <div className="skeleton" style={{height:36, width:'70%'}} />
            <div className="skeleton" style={{height:18, width:'40%'}} />
            <div className="skeleton" style={{height:320}} />
          </div>
        </section>
      </>
    );
  }

  if (tutorial._notFound) {
    return (
      <>
        <PageHead crumbs={['Outback','Tutorials','Not Found']} title="Tutorial not found"
          lead="Sorry — we couldn't find that tutorial. It may have been removed or the link may be incorrect." />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
            <button className="btn btn-rust" onClick={() => go('tutorials')}>Browse all Tutorials →</button>
            <button className="btn btn-ghost" onClick={() => go('contact')}>Contact us</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead crumbs={['Outback','Tutorials', tutorial.title]} title={tutorial.title} lead={tutorialExcerpt(tutorial)} />
      <section className="container" style={{paddingTop:32, paddingBottom:64}}>
        <div style={{maxWidth:760, margin:'0 auto'}}>
          <div className="row-flex" style={{gap:6, flexWrap:'wrap', marginBottom:12}}>
            {tutorial.locked && <span className="tag tag-rust">MEMBERS ONLY</span>}
            {!tutorial.locked && tutorial.cat && <span className="tag tag-outline">{tutorial.cat.toUpperCase()}</span>}
          </div>
          <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginBottom:tutorial.series?4:24}}>
            {[
              tutorial.author && tutorial.author.toUpperCase(),
              tutorial.difficulty,
              tutorial.duration,
            ].filter(Boolean).join(' · ')}
          </div>
          {tutorial.series && (
            <div className="mono" style={{fontSize:11, color:'var(--rust)', marginBottom:24}}>
              <a {...seriesLinkProps(tutorial.series, seriesParts.length ? seriesParts : [tutorial], go)} style={{color:'inherit', textDecoration:'underline'}}>{tutorial.series.toUpperCase()}</a>
              {' '}· PART {tutorial.seriesOrder||1}{seriesParts.length ? ` OF ${seriesParts.length}` : ''}
            </div>
          )}
          {tutorial.coverImage && (
            <img src={tutorial.coverImage} alt="" style={{width:'100%', maxHeight:400, objectFit:'cover', marginBottom:28}} />
          )}

          {tutorial.locked ? (
            <div style={{padding:32, background:'var(--bg-elev)', textAlign:'center'}}>
              <p style={{fontSize:15, color:'var(--ink-2)', marginBottom:16}}>This tutorial is available to members.</p>
              <a href="/memberships" className="btn btn-rust" style={{textDecoration:'none'}} onClick={e=>{e.preventDefault(); go('memberships');}}>Join to unlock →</a>
            </div>
          ) : (
            <TutorialContent tutorial={tutorial} />
          )}

          {tutorial.series && seriesParts.length > 0 && (() => {
            const idx = seriesParts.findIndex(p => p.id === tutorial.id);
            const prevPart = idx > 0 ? seriesParts[idx-1] : null;
            const nextPart = idx >= 0 && idx < seriesParts.length - 1 ? seriesParts[idx+1] : null;
            return (
              <div style={{marginTop:40, padding:24, background:'var(--bg-elev)', border:'1px solid var(--line)'}}>
                <div className="eyebrow" style={{marginBottom:12}}>
                  <a {...seriesLinkProps(tutorial.series, seriesParts, go)} style={{color:'inherit'}}>{tutorial.series}</a> — {seriesParts.length} PART{seriesParts.length===1?'':'S'}
                </div>
                <ol style={{listStyle:'none', margin:0, padding:0, display:'grid', gap:6}}>
                  {seriesParts.map(p => (
                    <li key={p.id} style={{fontSize:14}}>
                      {p.id === tutorial.id ? (
                        <span style={{fontWeight:600}}>#{p.seriesOrder||1} · {p.title}</span>
                      ) : (
                        <a {...tutorialLinkProps(p, go)} style={{textDecoration:'none', color:'var(--rust)'}}>#{p.seriesOrder||1} · {p.title}</a>
                      )}
                    </li>
                  ))}
                </ol>
                {(prevPart || nextPart) && (
                  <div className="row-flex" style={{gap:8, marginTop:18, flexWrap:'wrap'}}>
                    {prevPart && <a {...tutorialLinkProps(prevPart, go)} className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>← {prevPart.title}</a>}
                    {nextPart && <a {...tutorialLinkProps(nextPart, go)} className="btn btn-rust btn-sm" style={{textDecoration:'none', marginLeft:'auto'}}>{nextPart.title} →</a>}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{marginTop:40, paddingTop:24, borderTop:'1px solid var(--line)'}}>
            <a href="/tutorials" className="btn btn-ghost" style={{textDecoration:'none'}} onClick={e=>{e.preventDefault(); go('tutorials');}}>← All tutorials</a>
          </div>
        </div>
      </section>
    </>
  );
}

// Series landing page at /tutorials/series/:slug — pageParams is either
// { seriesName, slug, parts } (resolved by app.jsx's deep-link handling, or
// passed pre-resolved by a card/series-box link) or { _notFound: true }.
function SeriesPage({ go, pageParams }) {
  const series = pageParams;

  if (!series) {
    return (
      <>
        <PageHead crumbs={['Outback','Tutorials','Loading…']} title="Loading…" />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <div style={{maxWidth:760, margin:'0 auto', display:'grid', gap:14}}>
            <div className="skeleton" style={{height:36, width:'70%'}} />
            <div className="skeleton" style={{height:220}} />
          </div>
        </section>
      </>
    );
  }

  if (series._notFound) {
    return (
      <>
        <PageHead crumbs={['Outback','Tutorials','Not Found']} title="Series not found"
          lead="Sorry — we couldn't find that series. It may have been renamed or removed." />
        <section className="container" style={{paddingTop:32, paddingBottom:48}}>
          <button className="btn btn-rust" onClick={() => go('tutorials')}>Browse all Tutorials →</button>
        </section>
      </>
    );
  }

  const parts = series.parts || [];
  return (
    <>
      <PageHead crumbs={['Outback','Tutorials', series.seriesName]} title={series.seriesName}
        lead={`A ${parts.length}-part series from the Outback Electronics workshop.`} />
      <section className="container" style={{paddingTop:32, paddingBottom:64}}>
        <div style={{maxWidth:760, margin:'0 auto'}}>
          <ol style={{listStyle:'none', margin:0, padding:0, display:'grid', gap:12}}>
            {parts.map((p,i) => (
              <li key={p.id||i} className="card-paper" style={{padding:'18px 22px', opacity: p.locked ? 0.8 : 1}}>
                <div className="row-flex" style={{gap:12, alignItems:'flex-start'}}>
                  <span className="mono" style={{fontSize:13, color:'var(--paper)', background:'var(--rust)', width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center', flexShrink:0}}>{p.seriesOrder||i+1}</span>
                  <div style={{flex:1, minWidth:0}}>
                    {p.locked ? (
                      <h3 className="serif" style={{fontSize:19, lineHeight:1.2}}>{p.title}</h3>
                    ) : (
                      <a {...tutorialLinkProps(p, go)} style={{textDecoration:'none', color:'inherit'}}>
                        <h3 className="serif" style={{fontSize:19, lineHeight:1.2}}>{p.title}</h3>
                      </a>
                    )}
                    <p style={{marginTop:4, fontSize:13, color:'var(--ink-2)', lineHeight:1.5}}>{tutorialExcerpt(p)}</p>
                    <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>
                      {p.locked ? 'MEMBERS ONLY' : [p.difficulty, p.duration].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div style={{marginTop:32}}>
            <a href="/tutorials" className="btn btn-ghost" style={{textDecoration:'none'}} onClick={e=>{e.preventDefault(); go('tutorials');}}>← All tutorials</a>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// GROUPS
// ============================================================
function GroupsPage({ go }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/groups').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      const all = d.groups || d.items || [];
      setGroups(all.filter(g => g.status === 'active'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHead crumbs={['Outback','Groups']} title="Community Groups"
        lead="Online groups for electronics enthusiasts. Topic clubs, tinkerers, and fixers — connect and chat from wherever you are."
        kicker={<button className="btn btn-rust" onClick={() => go('contact')}>+ Start a group</button>} />

      <section className="container" style={{paddingTop: 32, paddingBottom: 40}}>
        {loading && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} style={{height:180, background:'var(--bg-elev)', animation:'pulse 1.4s ease-in-out infinite', opacity: 0.5 + (i % 2) * 0.2}} />
            ))}
          </div>
        )}
        {!loading && groups.length === 0 && (
          <div style={{padding:'48px 0'}}>
            <p className="serif" style={{fontSize:28, marginBottom:12}}>No groups yet.</p>
            <p style={{color:'var(--ink-2)', fontSize:15, maxWidth:520, lineHeight:1.7}}>
              Be the first to start one. Hit the button above and we'll get it set up.
            </p>
          </div>
        )}
        {!loading && groups.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {groups.map((g,i) => (
              <div key={g.id||i} className="card-paper" style={{padding:24, display:'flex', flexDirection:'column', gap:12, opacity: g.locked ? 0.8 : 1}}>
                <div>
                  {g.locked && <span className="tag tag-rust" style={{marginBottom:8, display:'inline-block'}}>MEMBERS ONLY</span>}
                  <h3 className="serif" style={{fontSize:24, lineHeight:1.1, marginTop:6}}>{g.name}</h3>
                  <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>{g.description}</p>
                </div>
                <div style={{borderTop:'1px solid var(--line)', paddingTop:12, display:'grid', gap:4}}>
                  {g.organizer && (
                    <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>ORGANISER: {g.organizer.toUpperCase()}</div>
                  )}
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{g.memberCount || 0} MEMBERS</div>
                  {g.locked && (
                    <a href="/memberships" className="btn btn-ghost btn-sm" style={{textDecoration:'none', marginTop:8, textAlign:'center'}}>Upgrade to join →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  tutorials: TutorialsPage,
  tutorial: TutorialPage,
  'tutorial-series': SeriesPage,
  groups: GroupsPage,
});
window.dispatchEvent(new Event('oe:pages-updated'));
