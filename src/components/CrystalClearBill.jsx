import React from 'react';

// Standard Code 39 Character encoding table
const CODE39 = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

export function BarcodeSvg({ text = 'W1235', height = 34 }) {
  const clean = ('*' + String(text).toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '') + '*').split('');
  let currentX = 0;
  const bars = [];

  clean.forEach((char) => {
    const pattern = CODE39[char] || CODE39['-'];
    for (let i = 0; i < 9; i++) {
      const isBar = i % 2 === 0;
      const isWide = pattern[i] === '1';
      const width = isWide ? 2.8 : 1.2;
      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
    currentX += 1.4; // space between characters
  });

  return (
    <svg
      width={currentX}
      height={height}
      viewBox={`0 0 ${currentX} ${height}`}
      style={{ display: 'block', maxWidth: '100%', height: `${height}px` }}
    >
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y="0" width={bar.width} height={height} fill="#000000" />
      ))}
    </svg>
  );
}

function formatDayAndDate(dateStr) {
  if (!dateStr) return { date: '—', time: '—', day: '—', fullDelivery: '—' };
  try {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr));
    const d = dateOnly
      ? new Date(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)))
      : new Date(dateStr);
    if (isNaN(d.getTime())) return { date: String(dateStr), time: '', day: '', fullDelivery: String(dateStr) };
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const dayName = dayNames[d.getDay()];

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const dateFormatted = `${day} ${month} ${year}`;
    const timeFormatted = `H ${hours}:${minutes}:${seconds} ${ampm}`;
    const deliveryFormatted = dateOnly ? `${day} ${month} ${year} /` : `${day} ${month} ${year} ${hours}:${minutes} ${ampm} /`;

    return {
      date: dateFormatted,
      time: timeFormatted,
      day: dayName,
      fullDelivery: deliveryFormatted,
    };
  } catch {
    return { date: String(dateStr), time: '', day: '', fullDelivery: String(dateStr) };
  }
}

export default function CrystalClearBill({
  order,
  customer,
  settings,
  cashierName = 'CC02',
  previousDue = 0,
}) {
  if (!order) return null;

  const storeName = settings?.storeName || 'Crystal Clear Dry Cleaning';
  const storeAddress = settings?.address || 'Near Union Bank, Wazirabad, Gurgaon-122004';
  const taxEnabled = settings?.taxEnabled !== false;
  const taxNumber = settings?.taxNumber || '';
  const expressPercent = Number(settings?.expressDeliveryPercent ?? 25);

  const orderNo = order.orderNo || order.id || '';
  const createdAtMeta = formatDayAndDate(order.createdAt || new Date().toISOString());
  const dueMeta = formatDayAndDate(order.dueDate || new Date().toISOString());

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge');
  const isWeight = order.type === 'weight';

  // Total pieces
  const totalPcs = isWeight
    ? (Number(order.weightClothesCount) || (order.weightKg ? Math.round(order.weightKg) : 1))
    : items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

  const advanceBalance = Number(customer?.walletBalance || 0);

  // Financial values
  const grossAmount = Number(order.grossAmount || 0);
  const packageDiscount = Number(order.discountAmount || 0);
  const checkoutDiscount = Number(
    order.manualCheckoutDiscountAmount ??
    (order.manualCheckoutDiscountPercent ? (grossAmount * Number(order.manualCheckoutDiscountPercent)) / 100 : 0)
  );
  const totalDiscount = Math.round((packageDiscount + checkoutDiscount) * 100) / 100;
  const discountAmount = totalDiscount;
  const discountPercent = Number(order.discountPercent || order.manualCheckoutDiscountPercent || 0);
  const expressAmount = Number(order.expressAmount || 0);

  const taxableSubtotal = Math.max(0, grossAmount - discountAmount) + expressAmount;
  const taxAmount = taxEnabled ? Number(order.taxAmount || 0) : 0;
  const taxPercent = taxEnabled ? Number(order.taxPercent || 18) : 0;
  // CGST/SGST halves that always add up to the tax amount.
  const halfTax = Math.round((taxAmount / 2) * 100) / 100;
  const otherHalfTax = Math.round((taxAmount - halfTax) * 100) / 100;

  const totalAmount = Number(order.totalAmount ?? (taxableSubtotal + taxAmount));
  const paidAmount = Number(order.paidAmount || 0);
  const prevDueVal = Number(previousDue || 0);
  const balanceDue = Math.max(0, prevDueVal + (totalAmount - paidAmount));
  const advance = 0.00; // Formula match

  // Round off calculation if any
  const calculatedSum = taxableSubtotal + taxAmount;
  const roundOff = Math.round((totalAmount - calculatedSum) * 100) / 100;

  // Spread the order discount across lines by amount; the last line takes the rounding remainder.
  const lineAmounts = items.map((it) => (Number(it.quantity) || 1)
    * ((Number(it.unitPrice) || 0) + (it.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0)));
  const lineSum = lineAmounts.reduce((a, b) => a + b, 0);
  const allocatable = Math.min(totalDiscount, lineSum);
  let allocated = 0;
  const lineDiscounts = lineAmounts.map((amt, i) => {
    if (lineSum <= 0) return 0;
    if (i === lineAmounts.length - 1) return Math.round((allocatable - allocated) * 100) / 100;
    const share = Math.round(((amt / lineSum) * allocatable) * 100) / 100;
    allocated += share;
    return share;
  });

  // Garment preference note
  const packagingPref = customer?.preference && customer.preference !== 'NA'
    ? customer.preference
    : 'Hanger';

  return (
    <div
      className="crystal-clear-bill"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        background: '#ffffff',
        color: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '24px 28px',
        boxSizing: 'border-box',
        lineHeight: 1.35,
      }}
    >
      {/* 1. STORE HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.2px',
            color: '#000000',
          }}
        >
          {storeName}
        </h1>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111', marginTop: '3px' }}>
          {storeAddress}
        </div>
      </div>

      {/* Top Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '10px 0 5px 0' }} />

      {/* GST Number Header Line */}
      {taxEnabled && taxNumber && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#000000',
            letterSpacing: '0.4px',
            padding: '2px 0',
          }}
        >
          GST Number: {taxNumber}
        </div>
      )}

      {/* Second Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '5px 0 12px 0' }} />

      {/* 2. ORDER META, BARCODE & CUSTOMER INFO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.1fr 1.7fr',
          gap: '14px',
          alignItems: 'center',
          paddingBottom: '12px',
        }}
      >
        {/* Left: Order No & Timestamp */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#000000', lineHeight: 1 }}>
            {orderNo}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000', lineHeight: 1.4 }}>
            <div>{createdAtMeta.date}</div>
            <div>{createdAtMeta.time}</div>
          </div>
        </div>

        {/* Center: Barcode graphic with scan label */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BarcodeSvg text={orderNo} height={32} />
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '2.5px',
              marginTop: '3px',
              color: '#000000',
            }}
          >
            * {orderNo} *
          </div>
        </div>

        {/* Right: Customer info */}
        <div style={{ fontSize: '12px', color: '#000000', lineHeight: 1.35 }}>
          <div style={{ fontWeight: 700 }}>
            {customer?.salutation ? `${customer.salutation} ` : ''}{customer?.name || 'Valued Customer'}-
          </div>
          {customer?.address && (
            <div style={{ color: '#111111' }}>
              {customer.address}
            </div>
          )}
          {customer?.state && (
            <div style={{ fontWeight: 600, marginTop: '2px' }}>
              Place of Supply- {customer.state}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '0 0 8px 0' }} />

      {/* 3. FINANCIAL BALANCE STRIP (MATHEMATICAL EQUATION) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr auto 1fr',
          alignItems: 'center',
          textAlign: 'center',
          padding: '4px 0 8px 0',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            INR : {prevDueVal.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
            Previous Due
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#000000', padding: '0 2px' }}>+</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            INR : {totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
            Due (this order)
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#000000', padding: '0 2px' }}>-</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            INR : {advance.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
            Advance
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#000000', padding: '0 2px' }}>-</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            INR : {paidAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
            Paid
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#000000', padding: '0 2px' }}>=</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            INR : {balanceDue.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
            Balance Due
          </div>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '0 0 8px 0' }} />

      {/* 4. TOTAL PCS & DELIVERY DATE STRIP */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: '#000000',
          padding: '2px 0 8px 0',
        }}
      >
        <div style={{ display: 'flex', gap: '32px' }}>
          <span>Total Pcs : {totalPcs}</span>
          <span>Advance Balance: {advanceBalance.toFixed(0)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span>Delivery Date :</span>
          <span>{dueMeta.fullDelivery}</span>
          <span>{dueMeta.day}</span>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '0 0 6px 0' }} />

      {/* 5. ITEM PARTICULAR'S TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#000000' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #000000' }}>
            <th style={{ padding: '6px 4px', width: '32%' }}>Particular's</th>
            <th style={{ padding: '6px 4px', width: '28%' }}>Service</th>
            <th style={{ padding: '6px 4px', textAlign: 'center', width: '6%' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '8%' }}>Rate</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '9%' }}>Amount</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '8%' }}>Discount</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '9%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {isWeight ? (
            <>
              <tr>
                <td style={{ padding: '8px 4px 2px 4px', fontWeight: 700 }}>
                  Weight Laundry - {order.service}
                </td>
                <td style={{ padding: '8px 4px 2px 4px' }}>
                  {order.service} (SAC-99971)
                </td>
                <td style={{ padding: '8px 4px 2px 4px', textAlign: 'center' }}>
                  {order.weightKg} kg
                </td>
                <td style={{ padding: '8px 4px 2px 4px', textAlign: 'right' }}>
                  {(order.weightKg > 0 ? grossAmount / order.weightKg : grossAmount).toFixed(0)}
                </td>
                <td style={{ padding: '8px 4px 2px 4px', textAlign: 'right' }}>
                  {grossAmount.toFixed(2)}
                </td>
                <td style={{ padding: '8px 4px 2px 4px', textAlign: 'right' }}>
                  {discountAmount > 0 ? discountAmount.toFixed(2) : ''}
                </td>
                <td style={{ padding: '8px 4px 2px 4px', textAlign: 'right', fontWeight: 600 }}>
                  {(grossAmount - discountAmount).toFixed(2)}
                </td>
              </tr>
              {order.weightGarments && order.weightGarments.length > 0 && (
                <tr style={{ fontSize: '11px', color: '#333333' }}>
                  <td colSpan={7} style={{ padding: '1px 4px 6px 4px', fontStyle: 'italic' }}>
                    Clothes: {order.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}
                  </td>
                </tr>
              )}
            </>
          ) : (
            items.map((item, idx) => {
              const qty = Number(item.quantity) || 1;
              const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
              const unitPrice = (Number(item.unitPrice) || 0) + addonExtra;
              const itemAmt = qty * unitPrice;
              const itemDis = lineDiscounts[idx] || 0;
              const itemTotal = Math.max(0, itemAmt - itemDis);

              // Prefix category if available (e.g. "Women - KAMEEZ WOM")
              const categoryPrefix = item.category ? `${item.category} - ` : '';
              const itemNameUpper = `${categoryPrefix}${item.name.toUpperCase()}`;

              return (
                <React.Fragment key={idx}>
                  <tr>
                    <td style={{ padding: '8px 4px 1px 4px', fontWeight: 700 }}>
                      {itemNameUpper}
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px' }}>
                      {item.service || order.service} (SAC-99971)
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px', textAlign: 'center' }}>
                      {qty}
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px', textAlign: 'right' }}>
                      {unitPrice.toFixed(0)}
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px', textAlign: 'right' }}>
                      {itemAmt.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px', textAlign: 'right' }}>
                      {itemDis > 0 ? itemDis.toFixed(2) : ''}
                    </td>
                    <td style={{ padding: '8px 4px 1px 4px', textAlign: 'right', fontWeight: 600 }}>
                      {itemTotal.toFixed(2)}
                    </td>
                  </tr>
                  {/* Secondary Packaging Preference line (matches Hanger 0 0.00 0.00) */}
                  <tr style={{ fontSize: '11px', color: '#111111' }}>
                    <td style={{ padding: '0 4px 6px 4px' }}></td>
                    <td style={{ padding: '0 4px 6px 4px', fontStyle: 'italic' }}>
                      {item.note || packagingPref}
                    </td>
                    <td style={{ padding: '0 4px 6px 4px' }}></td>
                    <td style={{ padding: '0 4px 6px 4px', textAlign: 'right' }}>0</td>
                    <td style={{ padding: '0 4px 6px 4px', textAlign: 'right' }}>0.00</td>
                    <td style={{ padding: '0 4px 6px 4px' }}></td>
                    <td style={{ padding: '0 4px 6px 4px', textAlign: 'right' }}>0.00</td>
                  </tr>
                </React.Fragment>
              );
            })
          )}

        </tbody>
      </table>

      {/* Horizontal Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '8px 0 5px 0' }} />

      {/* 6. SUBTOTAL STRIP WITH TERMS HEADER & TAX BREAKDOWN */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#000000',
          padding: '2px 0',
        }}
      >
        <div style={{ fontWeight: 700 }}>
          Terms and Conditions
          {taxEnabled && taxAmount > 0 && (
            <span style={{ fontWeight: 500, marginLeft: '6px' }}>
              ( CGST: {halfTax.toFixed(2)}, SGST: {otherHalfTax.toFixed(2)} = {taxAmount.toFixed(2)} )
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px', fontWeight: 700 }}>
          <span>Subtotal</span>
          <span style={{ minWidth: '60px', textAlign: 'right' }}>{grossAmount.toFixed(2)}</span>
          <span style={{ minWidth: '55px', textAlign: 'right' }}>{discountAmount > 0 ? discountAmount.toFixed(2) : ''}</span>
          <span style={{ minWidth: '60px', textAlign: 'right' }}>{taxableSubtotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div style={{ borderTop: '1.5px solid #000000', margin: '5px 0 10px 0' }} />

      {/* 7. FOOTER: TERMS ON LEFT, TAXES & NET DUE ON RIGHT */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '24px',
          fontSize: '11px',
          color: '#000000',
          lineHeight: 1.45,
        }}
      >
        {/* Left Column: Store Terms & Conditions */}
        <div>
          <div>All deliveries will be made in 72 Hours of Pick up.</div>
          <div>One day delivery is not available before weekly offs & public holidays.</div>
          <div style={{ marginTop: '14px', fontWeight: 700 }}>
            Urgent delivery of garments will be charged @ {expressPercent} % Extra.
          </div>
        </div>

        {/* Right Column: Taxes & Net Due */}
        <div style={{ textAlign: 'right' }}>
          {taxEnabled && taxAmount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span style={{ fontWeight: 700 }}>CGST ({(taxPercent / 2).toFixed(0)}%)</span>
                <span style={{ fontWeight: 600 }}>{halfTax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span style={{ fontWeight: 700 }}>SGST ({(taxPercent / 2).toFixed(0)}%)</span>
                <span style={{ fontWeight: 600 }}>{otherHalfTax.toFixed(2)}</span>
              </div>
            </>
          )}

          {roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ fontWeight: 700 }}>Round Off</span>
              <span style={{ fontWeight: 600 }}>{roundOff.toFixed(2)}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0 0 0',
              marginTop: '2px',
              fontSize: '13px',
              fontWeight: 900,
            }}
          >
            <span>Due (this order)</span>
            <span>{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
