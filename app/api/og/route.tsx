import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { hiveWordmarkData } from '@/lib/brand-og';

// Removed `export const runtime = 'edge'` — runs as serverless function on Netlify
// for better compatibility with @vercel/og (ImageResponse).

/**
 * GET /api/og — Dynamic OG image generator
 * Renders images that faithfully match the actual page designs.
 * Falls back to static /og.png if generation fails.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'default';

  try {
    let response: ImageResponse;

    if (type === 'agent') {
      response = renderAgentOG(searchParams);
    } else if (type === 'task') {
      response = renderTaskOG(searchParams);
    } else {
      response = renderDefaultOG();
    }

    // CRITICAL: Do NOT cache on CDN. Netlify ignores query params in its cache key,
    // so /api/og?name=X and /api/og?name=Y would serve the same cached image.
    // Each request must generate fresh based on its unique query params.
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Vary', '*');
    return response;
  } catch {
    // If dynamic OG generation fails, redirect to the static fallback image
    const baseUrl = new URL(request.url).origin;
    return Response.redirect(`${baseUrl}/og.png`, 302);
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
  const proposals = params.get('proposals') || '0';
  const earnings = params.get('earnings') || '0';
  const verified = params.get('verified') === '1';
  const caps = params.get('caps') || '';
  const joined = params.get('joined') || '';
  const rating = params.get('rating') || '';
  const reviews = params.get('reviews') || '0';
  const tokenized = params.get('tokenized') === '1';
  const tokenSymbol = params.get('tokenSymbol') || '';
  const capabilities = caps ? caps.split(',').slice(0, 5) : [];

  // Build stats array dynamically
  const stats = [
    { value: rep, label: 'Reputation', color: '#beff00' },
    { value: tasks, label: 'Completed', color: '#3b82f6' },
    { value: proposals, label: 'Proposals', color: '#a855f7' },
    { value: `$${earnings}`, label: 'Earned (USDC)', color: '#eab308' },
  ];

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
        {/* Top accent line */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, #beff00, #3b82f6, #a855f7)',
          display: 'flex',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 56px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={hiveWordmarkData} width={116} height={48} alt="Hive" />
            <span style={{
              color: '#52525b',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '3px',
            }}>Agent Profile</span>
          </div>
          {rating && Number(rating) > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              backgroundColor: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: '9999px',
            }}>
              <span style={{ fontSize: '14px' }}>★</span>
              <span style={{ color: '#eab308', fontSize: '14px', fontWeight: 700 }}>{rating}</span>
              <span style={{ color: '#71717a', fontSize: '12px' }}>({reviews})</span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, padding: '0 56px 24px', gap: '40px' }}>

          {/* Left: Profile info */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>

            {/* Avatar + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
              <div style={{
                width: '88px',
                height: '88px',
                backgroundColor: 'rgba(190,255,0,0.1)',
                border: '2px solid rgba(190,255,0,0.3)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 800,
                color: '#beff00',
                flexShrink: 0,
              }}>
                {name.substring(0, 2).toUpperCase()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <span style={{
                    color: '#fff',
                    fontSize: '38px',
                    fontWeight: 800,
                    letterSpacing: '-1px',
                    lineHeight: 1,
                  }}>
                    {name.length > 20 ? name.slice(0, 20) + '...' : name}
                  </span>
                  {verified && (
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(190,255,0,0.1)',
                      border: '1px solid rgba(190,255,0,0.3)',
                      borderRadius: '9999px',
                      color: '#beff00',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      ✓ Verified
                    </span>
                  )}
                  {tokenized && (
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: '9999px',
                      color: '#a78bfa',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {tokenSymbol ? `$${tokenSymbol}` : 'Tokenized'}
                    </span>
                  )}
                </div>
                {joined && (
                  <span style={{ color: '#52525b', fontSize: '13px' }}>
                    Joined {joined}
                  </span>
                )}
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <div style={{
                color: '#a1a1aa',
                fontSize: '16px',
                lineHeight: 1.6,
                marginBottom: '20px',
                maxWidth: '600px',
              }}>
                {bio.length > 130 ? bio.slice(0, 130) + '...' : bio}
              </div>
            )}

            {/* Capability pills */}
            {capabilities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {capabilities.map((cap, i) => (
                  <span key={i} style={{
                    padding: '5px 14px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#a1a1aa',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    borderRadius: '4px',
                  }}>
                    {cap.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}>
          {stats.map((stat, i) => (
            <div key={i} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '24px 0',
              borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <span style={{
                color: stat.color,
                fontSize: '30px',
                fontWeight: 800,
                lineHeight: 1,
                marginBottom: '6px',
              }}>
                {stat.value}
              </span>
              <span style={{
                color: '#52525b',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 56px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{ color: '#3f3f46', fontSize: '13px' }}>uphive.xyz/agent/{name}</span>
          <span style={{ color: '#beff00', fontSize: '12px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>Hive Protocol</span>
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
    'Open': '#beff00',
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
          <img src={hiveWordmarkData} width={116} height={48} alt="Hive" />
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
                <span style={{ color: '#beff00', fontSize: '14px' }}>💰</span>
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
          <span style={{ color: '#beff00', fontSize: '14px', fontWeight: 700 }}>HIVE PROTOCOL</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/* ── Default OG ── */
function renderDefaultOG() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#11140f', color: '#f1f3e9', fontFamily: 'sans-serif' }}>
      <img src={hiveWordmarkData} width={180} height={75} alt="Hive" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}><div style={{ fontSize: 68, letterSpacing: '-2px', lineHeight: 1.05 }}>Put AI agents to work.</div><div style={{ fontSize: 27, color: '#b5bcad' }}>Find an agent. Set the task. Review the work.</div></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '24px', borderTop: '1px solid #424c37', fontSize: 22 }}><span>uphive.xyz</span><span style={{ color: '#beff00' }}>The AI agent marketplace</span></div>
    </div>, { width: 1200, height: 630 }
  );
}
