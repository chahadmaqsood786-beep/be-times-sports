/**
 * GORSY MANUFACTURING - Shared Global UI & Interaction Engine
 * Manages currency conversions, modals, mobile navigation, and toasts across all pages.
 */

const GORSY_GLOBAL = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencyRate: 1.0
};

// Open any modal by ID
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// Close any modal by ID
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Quick quote modal trigger with pre-filled category & product
function openQuickQuote(category, product) {
  const catInput = document.getElementById('modalQuoteCategory');
  const prodInput = document.getElementById('modalQuoteProduct');
  if (catInput && category) catInput.value = category;
  if (prodInput && product) prodInput.value = product;
  openModal('quickQuoteModal');
}

// Currency Switcher
function setCurrency(code, symbol, rate) {
  GORSY_GLOBAL.currencyCode = code;
  GORSY_GLOBAL.currencySymbol = symbol;
  GORSY_GLOBAL.currencyRate = rate;

  const navLabels = document.querySelectorAll('.navCurrencyLabel');
  navLabels.forEach(lbl => {
    lbl.innerText = `${code} (${symbol.trim()})`;
  });

  // Update dynamic price tags on page
  document.querySelectorAll('[data-base-price]').forEach(el => {
    const base = parseFloat(el.getAttribute('data-base-price'));
    if (!isNaN(base)) {
      const converted = (base * rate).toFixed(2);
      el.innerText = `${symbol}${converted}`;
    }
  });

  closeModal('currencyModal');
  showToast(`Currency updated: ${code} (${symbol})`);
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('mobileMenuIcon');
  if (!menu) return;
  menu.classList.toggle('hidden');
  if (icon) {
    icon.innerText = menu.classList.contains('hidden') ? 'menu' : 'close';
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('mobileMenuIcon');
  if (menu) menu.classList.add('hidden');
  if (icon) icon.innerText = 'menu';
}

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColor = type === 'error' ? 'border-heritage-red' : 'border-primary-container/60';
  const icon = type === 'error' ? 'error' : (type === 'success' ? 'check_circle' : 'info');
  const iconColor = type === 'error' ? 'text-heritage-red' : 'text-primary-container';

  toast.className = `p-3.5 rounded-xl bg-surface-midnight border ${borderColor} text-pure-white text-xs font-label-sm shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex items-center gap-2.5 pointer-events-auto transition-all transform translate-y-3 opacity-0`;
  toast.innerHTML = `<span class="material-symbols-outlined ${iconColor} text-lg">${icon}</span><span class="leading-relaxed">${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// Legal Notice Modal
function showLegalModal(title, text) {
  const titleEl = document.getElementById('legalTitle');
  const bodyEl = document.getElementById('legalBody');
  if (titleEl) titleEl.innerText = title;
  if (bodyEl) bodyEl.innerText = text;
  openModal('legalModal');
}

// Blank Tech Pack Template Download
function downloadBlankTechPackTemplate() {
  const content = `===============================================================
               GORSY (PVT) LTD - OFFICIAL TECH PACK SPEC
               SIALKOT EXPORT PROCESSING ZONE (EPZ), PAKISTAN
===============================================================
BUYER / BRAND DETAILS:
Brand Name:
Contact Representative:
Corporate Email:
Phone / WhatsApp:
Target Delivery Date:

GARMENT SPECIFICATIONS:
Garment Type: (e.g., Football Match Jersey / Compression Leggings / Cricket Whites / Heavyweight Fleece Hoodie)
Target Fabric & GSM: (e.g., 160 GSM AeroPoly Interlock / 380 GSM French Terry)
Fabric Composition: (e.g., 100% Polyester / 92% Polyester 8% Spandex)
Seam Construction: (4-Needle 6-Thread Flatlock / 5-Thread Overlock / Twin Needle Hem)

PANTONE COLOR SPECIFICATIONS (TCX / C):
Primary Body: #
Sleeves / Accent: #
Collar / Ribbing: #
Side Panels / Mesh Inserts: #

SIZING RATIO BREAKDOWN (Total Pieces: _____):
Youth: YS(__) YM(__) YL(__) YXL(__)
Adults: S(__) M(__) L(__) XL(__) 2XL(__) 3XL(__) 4XL(__)

BRANDING & EMBELLISHMENTS:
1. Chest Crest Logo: [ ] 1440 DPI Sublimation  [ ] 3D Silicone  [ ] Tajima Embroidery  [ ] Woven Patch
2. Chest Sponsor / Artwork: [ ] Sublimation  [ ] Screen Print  [ ] DTF Transfer
3. Neck Label: [ ] Heat Transfer Tagless  [ ] Woven Damask Label
4. Packaging: [ ] Custom Matte Frosted Zipper Bag with Logo Print

SUBMISSION INSTRUCTIONS:
Submit this completed spec file along with your vector artwork (AI/EPS/PDF) directly via our website at:
https://gorsy.com/tech-pack or email directly to chahadmaqsood786@gmail.com
===============================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GORSY_Blank_TechPack_Template_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded Blank Tech Pack Template (TXT)!');
}

// Wholesale Catalog Download
function downloadWholesaleCatalog() {
  const content = `===============================================================
             GORSY INTERNATIONAL B2B EXPORT CATALOG 2026
             SIALKOT EXPORT PROCESSING ZONE (EPZ), PAKISTAN
===============================================================
1. SPORTSWEAR DIVISION (MOQ: 50 Pcs)
   - Pro Football Kits (160 GSM AeroPoly Interlock)
   - Basketball Reversible Uniforms (180 GSM Birdseye Mesh)
   - Cricket Sublimated Whites & T20 Kits (210 GSM Poly-Pique)
   - Baseball & Hockey Uniforms
   - Team Tracksuits & Sideline Outerwear

2. ACTIVEWEAR DIVISION (MOQ: 100 Pcs)
   - 4-Way Poly-Spandex Compression Tops & Leggings (240 GSM)
   - Heavyweight Streetwear Hoodies (380 GSM Brushed French Terry)
   - Performance Gym T-shirts & Joggers

3. SCHOOLWEAR DIVISION (MOQ: 100 Pcs)
   - School Pique Polo Shirts (210 GSM Combed Cotton/Poly)
   - Teflon-Coated School Trousers & Shorts
   - School Sweatshirts, Hoodies & PE Kits

4. SPORTS GOODS DIVISION (MOQ: 25 Pcs / 50 Balls)
   - Grade 1 English Willow Cricket Bats (Sizes 0, 1, 2, 3, 4, 5, 6, Harrow, SH)
   - Alum-Tanned 4-Piece Cricket Balls (156g, 142g, 135g in Red, White, Pink)
   - Hand-Stitched Club & Tournament Cricket Balls

Export Desk Email: chahadmaqsood786@gmail.com | Web: gorsy.com
===============================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'GORSY_Wholesale_Catalog_2026.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded GORSY Wholesale Export Catalog!');
}

// Global Escape Key Listener for Modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('[id$="Modal"]').forEach(m => m.classList.add('hidden'));
    document.body.style.overflow = '';
  }
});
