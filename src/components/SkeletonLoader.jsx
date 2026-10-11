import React from 'react';

/**
 * Primitive Skeleton Shimmer Block
 */
export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  style = {},
  className = '',
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        display: 'inline-block',
        ...style,
      }}
    />
  );
}

/**
 * Skeleton Loader for Garment Catalog Tiles in POS Register
 */
export function PosCatalogSkeleton({ count = 8 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '10px',
        padding: '4px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '12px 10px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Skeleton width="48px" height="48px" borderRadius="10px" />
          <Skeleton width="75%" height="13px" borderRadius="4px" />
          <Skeleton width="45%" height="11px" borderRadius="4px" />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <Skeleton width="35%" height="12px" borderRadius="4px" />
            <Skeleton width="24px" height="24px" borderRadius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Loader for Orders & Customers Table
 */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div style={{ width: '100%', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '16px', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height="14px" borderRadius="4px" />
        ))}
      </div>
      <div style={{ display: 'grid', gap: '1px', background: '#f1f5f9' }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '16px 20px',
              background: '#ffffff',
              alignItems: 'center',
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                width={`${100 / cols}%`}
                height={c === 0 ? '16px' : '13px'}
                borderRadius="4px"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full Screen Skeleton for Initial Fresh Fold Application Bootstrap
 */
export function AppSkeleton() {
  return (
    <div className="app-shell" style={{ overflow: 'hidden' }}>
      {/* Sidebar Skeleton */}
      <aside className="sidebar" style={{ pointerEvents: 'none' }}>
        <div className="brand-lockup">
          <Skeleton width="34px" height="34px" borderRadius="8px" />
          <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
            <Skeleton width="70%" height="14px" borderRadius="4px" />
            <Skeleton width="45%" height="9px" borderRadius="3px" />
          </div>
        </div>

        <div className="store-switcher" style={{ border: 'none' }}>
          <Skeleton width="100%" height="42px" borderRadius="8px" />
        </div>

        <div style={{ padding: '0 16px', margin: '14px 0 6px' }}>
          <Skeleton width="50px" height="10px" borderRadius="3px" />
        </div>

        <div style={{ display: 'grid', gap: '8px', padding: '0 12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height="38px" borderRadius="8px" />
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
          <Skeleton width="100%" height="48px" borderRadius="10px" />
        </div>
      </aside>

      {/* Main Shell Skeleton */}
      <div className="main-shell" style={{ pointerEvents: 'none' }}>
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Skeleton width="32px" height="32px" borderRadius="6px" />
            <Skeleton width="130px" height="16px" borderRadius="4px" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', maxWidth: '680px' }}>
            <Skeleton width="55%" height="38px" borderRadius="8px" />
            <Skeleton width="100px" height="32px" borderRadius="6px" />
            <Skeleton width="36px" height="36px" borderRadius="8px" />
          </div>
        </header>

        <main className="page-content" style={{ display: 'grid', gap: '18px' }}>
          {/* Top Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton width="60%" height="12px" borderRadius="4px" />
                  <Skeleton width="28px" height="28px" borderRadius="6px" />
                </div>
                <Skeleton width="45%" height="24px" borderRadius="6px" />
                <Skeleton width="80%" height="10px" borderRadius="3px" />
              </div>
            ))}
          </div>

          {/* 2-Column POS Layout Skeleton */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 340px',
              gap: '16px',
            }}
          >
            {/* Catalog Panel Skeleton */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
                display: 'grid',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Skeleton width="110px" height="36px" borderRadius="8px" />
                  <Skeleton width="110px" height="36px" borderRadius="8px" />
                </div>
                <Skeleton width="140px" height="14px" borderRadius="4px" />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} width="90px" height="32px" borderRadius="6px" />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <Skeleton width="65%" height="38px" borderRadius="8px" />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Skeleton width="60px" height="38px" borderRadius="6px" />
                  <Skeleton width="60px" height="38px" borderRadius="6px" />
                </div>
              </div>

              <PosCatalogSkeleton count={8} />
            </div>

            {/* Ticket Panel Skeleton */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px 16px',
                display: 'grid',
                gap: '14px',
                height: 'fit-content',
              }}
            >
              <div style={{ display: 'grid', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width="70px" height="12px" borderRadius="4px" />
                  <Skeleton width="60px" height="18px" borderRadius="6px" />
                </div>
                <Skeleton width="60%" height="16px" borderRadius="4px" />
                <Skeleton width="40%" height="11px" borderRadius="4px" />
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: '4px', width: '60%' }}>
                      <Skeleton width="80%" height="13px" borderRadius="4px" />
                      <Skeleton width="50%" height="10px" borderRadius="3px" />
                    </div>
                    <Skeleton width="60px" height="24px" borderRadius="6px" />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width="90px" height="12px" borderRadius="4px" />
                  <Skeleton width="60px" height="12px" borderRadius="4px" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton width="80px" height="12px" borderRadius="4px" />
                  <Skeleton width="55px" height="12px" borderRadius="4px" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                  <Skeleton width="90px" height="16px" borderRadius="4px" />
                  <Skeleton width="75px" height="18px" borderRadius="4px" />
                </div>
              </div>

              <Skeleton width="100%" height="44px" borderRadius="8px" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Skeleton Loader for Digital Receipt View
 */
export function BillSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 12px 60px' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Skeleton width="34px" height="34px" borderRadius="8px" />
            <Skeleton width="160px" height="18px" borderRadius="4px" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton width="110px" height="36px" borderRadius="8px" />
            <Skeleton width="100px" height="36px" borderRadius="8px" />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <Skeleton width="180px" height="24px" borderRadius="6px" />
              <Skeleton width="140px" height="12px" borderRadius="4px" />
              <Skeleton width="220px" height="11px" borderRadius="4px" />
            </div>
            <div style={{ textAlign: 'right', display: 'grid', gap: '6px', justifyItems: 'end' }}>
              <Skeleton width="100px" height="28px" borderRadius="6px" />
              <Skeleton width="140px" height="14px" borderRadius="4px" />
              <Skeleton width="110px" height="11px" borderRadius="4px" />
            </div>
          </div>

          <Skeleton width="100%" height="48px" borderRadius="8px" />

          <div style={{ display: 'grid', gap: '10px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <Skeleton width="40%" height="14px" borderRadius="4px" />
                <Skeleton width="15%" height="14px" borderRadius="4px" />
                <Skeleton width="15%" height="14px" borderRadius="4px" />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
            <div style={{ width: '280px', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width="80px" height="12px" borderRadius="4px" />
                <Skeleton width="60px" height="12px" borderRadius="4px" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width="70px" height="12px" borderRadius="4px" />
                <Skeleton width="50px" height="12px" borderRadius="4px" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <Skeleton width="90px" height="16px" borderRadius="4px" />
                <Skeleton width="70px" height="18px" borderRadius="4px" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
