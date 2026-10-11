import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  icon: Icon,
  width,
  minWidth = '160px',
  searchable = false,
  searchPlaceholder = 'Search options...',
  disabled = false,
  className = '',
  style = {},
  menuStyle = {},
  dropUp = false,
  theme = 'light',
}) {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to [{ value, label, sublabel, badge, icon }]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) };
    }
    return {
      value: opt.value ?? opt.id ?? opt.name,
      label: opt.label ?? opt.name ?? String(opt.value),
      sublabel: opt.sublabel ?? opt.mobile ?? opt.description,
      badge: opt.badge ?? opt.role,
      icon: opt.icon,
      disabled: opt.disabled,
    };
  });

  // Selected item
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Filter options if searchable
  const isSearchEnabled = searchable || normalizedOptions.length > 7;
  const filteredOptions = isSearchEnabled && searchQuery.trim()
    ? normalizedOptions.filter((opt) => {
        const query = searchQuery.toLowerCase();
        return (
          opt.label.toLowerCase().includes(query) ||
          (opt.sublabel && String(opt.sublabel).toLowerCase().includes(query)) ||
          (opt.badge && String(opt.badge).toLowerCase().includes(query))
        );
      })
    : normalizedOptions;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when opened
      if (isSearchEnabled) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isSearchEnabled]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (option) => {
    if (option.disabled) return;
    setIsOpen(false);
    setSearchQuery('');
    if (onChange) {
      // Support both event-style (e.target.value) and direct value
      const syntheticEvent = { target: { value: option.value } };
      onChange(option.value, syntheticEvent);
      // Also provide target in case caller expects e.target.value directly as 1st param:
      if (typeof onChange === 'function') {
        try {
          onChange({ target: { value: option.value }, value: option.value });
        } catch {
          onChange(option.value);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: width || (style.width ? style.width : 'auto'),
        minWidth: width ? undefined : minWidth,
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          background: disabled ? (isDark ? '#0f172a' : '#f1f5f9') : (isDark ? '#1e293b' : '#ffffff'),
          border: isOpen ? '1.5px solid #2563eb' : (isDark ? '1px solid #334155' : '1px solid #cbd5e1'),
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: disabled ? '#94a3b8' : selectedOption ? (isDark ? '#f8fafc' : '#1e293b') : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {Icon && <Icon size={15} color={isOpen ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b')} style={{ flexShrink: 0 }} />}
          {selectedOption?.icon && <span style={{ flexShrink: 0 }}>{selectedOption.icon}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: selectedOption ? 600 : 500,
              }}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: isDark ? '#334155' : '#ede9fe',
                  color: isDark ? '#e2e8f0' : '#6d28d9',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedOption.badge}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={15}
          color={isOpen ? '#2563eb' : '#94a3b8'}
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Styled Dropdown Menu (NOT native OS dropdown) */}
      {isOpen && (
        <div
          className="custom-select-menu"
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 1000,
            left: 0,
            right: 0,
            ...(dropUp
              ? { bottom: 'calc(100% + 5px)' }
              : { top: 'calc(100% + 5px)' }),
            background: isDark ? '#1e293b' : '#ffffff',
            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
            padding: '6px',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInSlide 0.15s ease-out',
            minWidth: '200px',
            ...menuStyle,
          }}
        >
          {/* Optional In-Menu Search Input */}
          {isSearchEnabled && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                marginBottom: '6px',
                background: isDark ? '#0f172a' : '#f8fafc',
                borderRadius: '6px',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              }}
            >
              <Search size={13} color="#94a3b8" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '12px',
                  color: isDark ? '#f8fafc' : '#1e293b',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div
            style={{
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isSelected ? (isDark ? '#2563eb' : '#eff6ff') : 'transparent',
                      color: isSelected ? (isDark ? '#ffffff' : '#1d4ed8') : (isDark ? '#e2e8f0' : '#334155'),
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'left',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc';
                        e.currentTarget.style.color = isDark ? '#ffffff' : '#0f172a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = isDark ? '#e2e8f0' : '#334155';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.label}
                        </div>
                        {opt.sublabel && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: isSelected ? '#3b82f6' : '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '1px',
                            }}
                          >
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isSelected ? '#dbeafe' : '#f1f5f9',
                            color: isSelected ? '#1e40af' : '#475569',
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} color="#2563eb" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
