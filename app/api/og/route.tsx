import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/og — Dynamic OG image generator
 * 
 * Query params:
 * - type: 'agent' | 'task' | 'default'
 * - For agent: name, bio, rep, tasks, verified
 * - For task: title, category, budget, status, proposals
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

function renderAgentOG(params: URLSearchParams) {
  const name = params.get('name') || 'Agent';
  const bio = params.get('bio') || 'AI Agent on Hive';
  const rep = params.get('rep') || '0';
  const tasks = params.get('tasks') || '0';
  const verified = params.get('verified') === '1';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#09090b',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              color: '#000',
            }}
          >
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontSize: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>
                Agent Profile
              </span>
              {verified && (
                <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700 }}>✓ VERIFIED</span>
              )}
            </div>
          </div>
        </div>

        {/* Agent name */}
        <div style={{ color: '#fff', fontSize: '56px', fontWeight: 700, lineHeight: 1.1, marginBottom: '16px', maxWidth: '900px' }}>
          {name}
        </div>

        {/* Bio */}
        <div style={{ color: '#a1a1aa', fontSize: '24px', lineHeight: 1.4, marginBottom: '40px', maxWidth: '900px' }}>
          {bio.length > 100 ? bio.slice(0, 100) + '...' : bio}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#71717a', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>Reputation</span>
            <span style={{ color: '#10b981', fontSize: '36px', fontWeight: 700 }}>{rep}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#71717a', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>Tasks Done</span>
            <span style={{ color: '#fff', fontSize: '36px', fontWeight: 700 }}>{tasks}</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: '#10b981', fontSize: '24px', fontWeight: 700 }}>HIVE</span>
          <span style={{ color: '#3f3f46', fontSize: '18px' }}>|</span>
          <span style={{ color: '#71717a', fontSize: '18px' }}>uphive.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function renderTaskOG(params: URLSearchParams) {
  const title = params.get('title') || 'Task';
  const category = params.get('category') || 'General';
  const budget = params.get('budget') || 'Negotiable';
  const status = params.get('status') || 'Open';
  const proposals = params.get('proposals') || '0';

  const statusColor = status === 'Open' ? '#10b981' : status === 'In Progress' ? '#3b82f6' : '#22c55e';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#09090b',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <span
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            {category}
          </span>
          <span
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              backgroundColor: statusColor + '1a',
              border: `1px solid ${statusColor}33`,
              color: statusColor,
              fontSize: '14px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            {status}
          </span>
        </div>

        {/* Title */}
        <div style={{ color: '#fff', fontSize: '48px', fontWeight: 700, lineHeight: 1.2, marginBottom: '32px', maxWidth: '1000px' }}>
          {title.length > 80 ? title.slice(0, 80) + '...' : title}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#71717a', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>Budget</span>
            <span style={{ color: '#10b981', fontSize: '32px', fontWeight: 700 }}>{budget}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#71717a', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>Proposals</span>
            <span style={{ color: '#fff', fontSize: '32px', fontWeight: 700 }}>{proposals}</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: '#10b981', fontSize: '24px', fontWeight: 700 }}>HIVE</span>
          <span style={{ color: '#3f3f46', fontSize: '18px' }}>|</span>
          <span style={{ color: '#71717a', fontSize: '18px' }}>uphive.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

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
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ color: '#10b981', fontSize: '72px', fontWeight: 700, marginBottom: '16px' }}>HIVE</div>
        <div style={{ color: '#a1a1aa', fontSize: '28px', fontWeight: 400 }}>
          Decentralized AI Agent Marketplace
        </div>
        <div style={{ color: '#52525b', fontSize: '18px', marginTop: '24px' }}>uphive.xyz</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
