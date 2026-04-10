import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/og — Dynamic OG image generator
 * Renders images that faithfully match the actual page designs.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'default';

  try {
    if (type === 'agent') {
      return renderAgentOG(searchParams);
    } else if (type === 'task') {
      return renderTaskOG(searchParams);
    } else {
      return renderDefaultOG();
    }
  } catch {
    return renderDefaultOG();
  }
}

/* ── Agent Profile OG ──
 * Matches the actual /agent/[name] page layout:
 * - Dark card with border, avatar circle, name, verified badge
 * - Bio, join date, capability pills
 * - Stats row: reputation + success rate
 */
function renderAgentOG(params: URLSearchParams) {
  const name = params.get('name') || 'Agent';
  const bio = params.get('bio') || '';
  const rep = params.get('rep') || '0';
  const tasks = params.get('tasks') || '0';
  const verified = params.get('verified') === '1';
  const caps = params.get('caps') || '';
  const joined = params.get('joined') || '';
  const capabilities = caps ? caps.split(',').slice(0, 6) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '0',
        }}
      >
        {/* Navbar mimic */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '20px 60px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#10b981', fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>HIVE</span>
          <span style={{ color: '#10b981', fontSize: '10px', marginLeft: '12px', padding: '2px 8px', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '9999px' }}>LIVE</span>
        </div>

        {/* Main content area */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '32px 60px', flex: 1 }}>

          {/* Profile Card — matches the actual page card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0A0A0A',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '2px',
            padding: '32px 40px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
              {/* Avatar */}
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: 800,
                color: '#10b981',
                flexShrink: 0,
              }}>
                {name.substring(0, 2).toUpperCase()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{
                    color: '#fff',
                    fontSize: '36px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '-1px',
                  }}>
                    {name}
                  </span>
                  {verified && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#10b981',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                    }}>
                      ✓ Verified
                    </span>
                  )}
                </div>

                {/* Bio */}
                {bio && (
                  <div style={{
                    color: '#a1a1aa',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    maxWidth: '800px',
                  }}>
                    {bio.length > 120 ? bio.slice(0, 120) + '...' : bio}
                  </div>
                )}

                {/* Joined date */}
                {joined && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#71717a',
                    fontSize: '12px',
                    letterSpacing: '1px',
                    marginBottom: '12px',
                  }}>
                    📅 Joined {joined}
                  </div>
                )}

                {/* Capability pills */}
                {capabilities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {capabilities.map((cap, i) => (
                      <span key={i} style={{
                        padding: '4px 10px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#d4d4d8',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        borderRadius: '2px',
                      }}>
                        {cap.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats row — matches the 2-column grid on actual page */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Reputation card */}
            <div style={{
              flex: 1,
              backgroundColor: '#0A0A0A',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#10b981',
                fontSize: '32px',
                fontWeight: 700,
              }}>
                ⭐ {rep}
              </div>
              <div style={{
                color: '#71717a',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: 600,
                marginTop: '4px',
              }}>
                Reputation
              </div>
            </div>

            {/* Tasks completed card */}
            <div style={{
              flex: 1,
              backgroundColor: '#0A0A0A',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#eab308',
                fontSize: '32px',
                fontWeight: 700,
              }}>
                📊 {tasks}
              </div>
              <div style={{
                color: '#71717a',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: 600,
                marginTop: '4px',
              }}>
                Tasks Completed
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 60px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#52525b', fontSize: '14px' }}>uphive.xyz/agent/{name}</span>
          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700 }}>HIVE PROTOCOL</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/* ── Task Detail OG ──
 * Matches the actual /marketplace/[taskId] page:
 * - Category + status badges at top
 * - Large title
 * - Description preview
 * - Budget card + proposals count
 */
function renderTaskOG(params: URLSearchParams) {
  const title = params.get('title') || 'Task';
  const category = params.get('category') || 'General';
  const budget = params.get('budget') || 'Negotiable';
  const status = params.get('status') || 'Open';
  const proposals = params.get('proposals') || '0';
  const desc = params.get('desc') || '';

  const statusColors: Record<string, string> = {
    'Open': '#10b981',
    'In Progress': '#3b82f6',
    'Completed': '#22c55e',
  };
  const statusColor = statusColors[status] || '#71717a';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Navbar mimic */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '20px 60px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#10b981', fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>HIVE</span>
          <span style={{ color: '#71717a', fontSize: '14px', marginLeft: '24px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>Marketplace</span>
        </div>

        {/* Main content — 2 column like actual page */}
        <div style={{ display: 'flex', flex: 1, padding: '32px 60px', gap: '32px' }}>

          {/* Left column — task info */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <span style={{
                padding: '6px 14px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#d4d4d8',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                borderRadius: '2px',
              }}>
                {category}
              </span>
              <span style={{
                padding: '6px 14px',
                backgroundColor: statusColor + '1a',
                border: `1px solid ${statusColor}33`,
                color: statusColor,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                ● {status}
              </span>
            </div>

            {/* Title */}
            <div style={{
              color: '#fff',
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: '20px',
              maxWidth: '700px',
            }}>
              {title.length > 70 ? title.slice(0, 70) + '...' : title}
            </div>

            {/* Description section */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              marginBottom: '16px',
            }}>
              <span style={{
                color: '#71717a',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '3px',
                marginBottom: '12px',
              }}>
                Description
              </span>
              {desc && (
                <span style={{
                  color: '#a1a1aa',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  maxWidth: '650px',
                }}>
                  {desc.length > 160 ? desc.slice(0, 160) + '...' : desc}
                </span>
              )}
            </div>
          </div>

          {/* Right column — budget card (matches sidebar on actual page) */}
          <div style={{
            width: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flexShrink: 0,
          }}>
            {/* Budget card */}
            <div style={{
              backgroundColor: '#0A0A0A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '2px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <span style={{
                color: '#71717a',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '3px',
                marginBottom: '12px',
              }}>
                Budget
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}>
                <span style={{ color: '#10b981', fontSize: '14px' }}>💰</span>
                <span style={{
                  color: '#fff',
                  fontSize: '28px',
                  fontWeight: 700,
                }}>
                  {budget}
                </span>
                <span style={{ color: '#71717a', fontSize: '14px' }}>USDC</span>
              </div>

              {/* Status bar */}
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '2px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}>
                <span style={{
                  color: '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}>
                  Accepting Proposals
                </span>
              </div>

              <span style={{
                color: '#52525b',
                fontSize: '12px',
                textAlign: 'center',
              }}>
                {proposals} proposal{proposals !== '1' ? 's' : ''} submitted
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 60px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#52525b', fontSize: '14px' }}>uphive.xyz/marketplace</span>
          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700 }}>HIVE PROTOCOL</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/* ── Default OG ── */
function renderDefaultOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{
          color: '#10b981',
          fontSize: '80px',
          fontWeight: 800,
          letterSpacing: '-3px',
          marginBottom: '16px',
        }}>
          HIVE
        </div>
        <div style={{
          color: '#a1a1aa',
          fontSize: '24px',
          fontWeight: 400,
          marginBottom: '32px',
        }}>
          Decentralized AI Agent Marketplace
        </div>
        <div style={{
          display: 'flex',
          gap: '24px',
        }}>
          {['Post Tasks', 'Hire AI Agents', 'Pay with Crypto'].map((text, i) => (
            <span key={i} style={{
              padding: '8px 20px',
              backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: '#10b981',
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              borderRadius: '2px',
            }}>
              {text}
            </span>
          ))}
        </div>
        <div style={{ color: '#52525b', fontSize: '16px', marginTop: '40px' }}>uphive.xyz</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
