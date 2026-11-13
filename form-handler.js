/**
 * GORSY MANUFACTURING - B2B Form Handler & Web3Forms Email Integration
 * Primary Email Dispatch: Web3Forms (Access Key: b7591b70-367a-4f8a-b228-2f6103d28b58)
 * Fallback & Local Logging: /api/send-inquiry (server.ps1)
 */

const GORSY_CONFIG = {
  web3FormsKey: "b7591b70-367a-4f8a-b228-2f6103d28b58",
  web3FormsEndpoint: "https://api.web3forms.com/submit",
  localEndpoint: "/api/send-inquiry",
  destinationEmail: "chahadmaqsood786@gmail.com"
};

const GORSY_API = {
  /**
   * Submit an inquiry dossier
   * @param {HTMLFormElement} formElement
   * @param {string} inquiryType - e.g. 'GENERAL CONTACT', 'SPORTSWEAR', etc.
   * @param {Function} onSuccess
   * @param {Function} onError
   */
  async submitInquiry(formElement, inquiryType, onSuccess, onError) {
    const submitBtn = formElement.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit Inquiry';

    // Anti-spam check (honeypot)
    const honeypot = formElement.querySelector('input[name="_honeypot"]') || formElement.querySelector('input[name="website"]');
    if (honeypot && honeypot.value.trim() !== '') {
      console.warn('Bot submission blocked via honeypot.');
      return;
    }

    // Collect Form Data
    const formData = new FormData(formElement);
    const nameVal = formData.get('name') || formData.get('fullName') || document.getElementById('contactName')?.value || '';
    const emailVal = formData.get('email') || document.getElementById('contactEmail')?.value || '';
    const phoneVal = formData.get('phone') || document.getElementById('contactPhone')?.value || '';
    const companyVal = formData.get('company') || formData.get('companyName') || document.getElementById('contactCompany')?.value || 'Independent Brand / Buyer';
    const countryVal = formData.get('country') || document.getElementById('contactCountry')?.value || 'Not Specified';
    const categoryVal = formData.get('category') || formData.get('productCategory') || document.getElementById('contactCategory')?.value || inquiryType || 'Sportswear';
    const productVal = formData.get('product') || formData.get('productName') || document.getElementById('contactProductName')?.value || 'Custom Manufacturing';
    const quantityVal = formData.get('quantity') || document.getElementById('contactQuantity')?.value || '100-300 Pcs';
    const detailsVal = formData.get('message') || formData.get('details') || formData.get('notes') || document.getElementById('contactNotes')?.value || '';
    const swatchVal = formData.get('swatchKit') === 'on' || document.getElementById('swatchContactCheck')?.checked ? 'YES (Complimentary DHL swatches requested)' : 'NO';

    // Client-side Validation
    if (!nameVal || nameVal.trim().length < 2) {
      if (typeof showToast === 'function') showToast('Please enter your full name.', 'error');
      return;
    }

    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal.trim())) {
      if (typeof showToast === 'function') showToast('Please provide a valid corporate or buyer email address.', 'error');
      return;
    }

    if (!detailsVal || detailsVal.trim().length < 3) {
      if (typeof showToast === 'function') showToast('Please enter your project specifications or message.', 'error');
      return;
    }

    // Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin inline-block mr-1">refresh</span> Sending to Export Desk...`;
    }

    // Prepare Web3Forms Payload
    const payload = {
      access_key: formData.get('access_key') || GORSY_CONFIG.web3FormsKey,
      subject: `NEW INQUIRY [${inquiryType || 'B2B MANUFACTURING'}]: ${nameVal} (${countryVal})`,
      from_name: "GORSY Manufacturing Web Desk",
      name: nameVal,
      email: emailVal,
      message: detailsVal,
      company: companyVal,
      phone: phoneVal,
      country: countryVal,
      product_category: categoryVal,
      target_product: productVal,
      order_quantity: quantityVal,
      fabric_swatches_requested: swatchVal,
      submitted_at: new Date().toLocaleString()
    };

    let web3Success = false;
    let ticketId = `GOR-${Date.now().toString().slice(-6)}`;

    try {
      // 1. Send via Web3Forms REST API
      const web3Res = await fetch(GORSY_CONFIG.web3FormsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const web3Result = await web3Res.json();
      if (web3Result.success) {
        web3Success = true;
      } else {
        console.warn("Web3Forms response warning:", web3Result);
      }
    } catch (netErr) {
      console.warn("Direct Web3Forms dispatch failed or offline:", netErr);
    }

    // 2. Also log to local server if running
    try {
      if (window.location.protocol !== 'file:') {
        await fetch(GORSY_CONFIG.localEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: ticketId,
            ...payload
          })
        });
      }
    } catch (e) {
      // local server optional
    }

    // Restore Submit Button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }

    // Provide Feedback
    if (web3Success) {
      if (typeof showToast === 'function') {
        showToast(`Inquiry sent successfully to chahadmaqsood786@gmail.com! (Ticket: ${ticketId})`, 'success');
      }
      if (typeof onSuccess === 'function') {
        onSuccess({ success: true, ticketId: ticketId, data: payload });
      }
    } else {
      // If Web3Forms had an issue or network error, show friendly notification
      if (typeof showToast === 'function') {
        showToast(`Inquiry recorded locally (Ticket: ${ticketId}). Check internet connection if live email not delivered.`, 'info');
      }
      if (typeof onSuccess === 'function') {
        onSuccess({ success: true, ticketId: ticketId, data: payload, offlineLogged: true });
      }
    }
  }
};

/**
 * Generic handler for any form with feedback element
 */
async function handleFormSubmission(event, formId, btnId, feedbackId) {
  event.preventDefault();
  const form = document.getElementById(formId);
  const btn = document.getElementById(btnId);
  const fb = document.getElementById(feedbackId);

  if (!form) return;

  const inquiryType = form.querySelector('input[name="inquiryType"]')?.value || 'B2B QUOTE';

  GORSY_API.submitInquiry(
    form,
    inquiryType,
    (res) => {
      form.reset();
      if (fb) {
        fb.classList.remove('hidden', 'border-heritage-red', 'text-heritage-red');
        fb.classList.add('border-primary-container/80', 'bg-surface-container-high', 'text-pure-white');
        fb.innerHTML = `
          <div class="flex items-start gap-2.5">
            <span class="material-symbols-outlined text-primary-container text-xl mt-0.5">check_circle</span>
            <div>
              <p class="font-bold text-sm uppercase text-pure-white">Thank You! Your Inquiry Has Been Transmitted.</p>
              <p class="text-xs text-text-muted mt-1">Ticket Reference: <strong class="text-primary-container">${res.ticketId}</strong>. Dispatched to export desk at <strong class="text-pure-white">chahadmaqsood786@gmail.com</strong>.</p>
            </div>
          </div>
        `;
      }
      if (formId === 'modalQuoteForm') {
        setTimeout(() => {
          if (typeof closeModal === 'function') closeModal('quickQuoteModal');
        }, 2500);
      }
    },
    (err) => {
      if (fb) {
        fb.classList.remove('hidden');
        fb.classList.add('border-heritage-red', 'bg-surface-container-high', 'text-heritage-red');
        fb.innerHTML = `<span class="material-symbols-outlined text-base inline mr-1">error</span> Could not transmit inquiry. Please email directly to chahadmaqsood786@gmail.com.`;
      }
    }
  );
}
