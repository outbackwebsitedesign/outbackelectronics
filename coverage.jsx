import { useState } from 'react';
import { TopNav, Footer } from './app-shell.jsx';

const CARRIERS = [
  { label: 'All carriers', id: '-' },
  { label: 'Telstra',      id: '2445.Telstra' },
  { label: 'Optus',        id: '2326.Optus' },
  { label: 'Vodafone',     id: '2106714.Vodafone-Mobile' },
];

function nPerfUrl(carrierId) {
  return `https://www.nperf.com/en/map/AU/-/${carrierId}/signal/?ll=-27&lng=134&zoom=5`;
}

export default function CoverageApp() {
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [blocked, setBlocked] = useState(false);

  return (
    <>
      <TopNav current="coverage" />
      <div className="cov-wrap">
        <div className="cov-bar">
          <span className="cov-bar-label">Carrier</span>
          <div className="cov-chips">
            {CARRIERS.map(c => (
              <button
                key={c.id}
                className={'cov-chip' + (carrier.id === c.id ? ' on' : '')}
                onClick={() => setCarrier(c)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <a
            className="cov-ext"
            href={nPerfUrl(carrier.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in nperf ↗
          </a>
        </div>

        {blocked ? (
          <div className="cov-fallback">
            <p>The coverage map couldn't load in this frame.</p>
            <a
              className="btn btn-rust"
              href={nPerfUrl(carrier.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {carrier.label} coverage map →
            </a>
          </div>
        ) : (
          <iframe
            key={carrier.id}
            className="cov-frame"
            src={nPerfUrl(carrier.id)}
            title={`${carrier.label} coverage map — Australia`}
            onError={() => setBlocked(true)}
            allow="geolocation"
          />
        )}
      </div>
      <Footer />
    </>
  );
}
