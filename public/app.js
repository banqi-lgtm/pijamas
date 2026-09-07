/**
 * ALFA ELECTRONIC COLOMBIA SAS - Corporate Landing Page Logic
 * Modern, Clean, White B2B Aesthetic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  initMobileMenu();
  initCounters();
  initSmoothScrollToTop();
});

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Smooth Scroll to Top for Inicio Links
 * Keeps top bar and hero title perfectly positioned at top 0 without clipping
 */
function initSmoothScrollToTop() {
  document.querySelectorAll('a[href="#inicio"], a[href="#top"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.history && window.history.pushState) {
        history.pushState(null, '', window.location.pathname);
      }
    });
  });
}

/**
 * Mobile Navigation Toggle
 */
function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('mobile-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    nav.classList.toggle('hidden');
  });

  nav.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.add('hidden');
    });
  });
}

/**
 * Direct WhatsApp Consultation for Services and Components
 */
window.openQuoteWith = function(serviceOrItem) {
  const msg = `Hola ALFA Electronic, deseo solicitar información / diagnóstico para: ${serviceOrItem}`;
  const waUrl = `https://wa.me/573174351630?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Fast Animated Counters (from 0 to target value)
 */
function initCounters() {
  const counterElements = document.querySelectorAll('.counter-value');
  if (!counterElements.length) return;

  const animate = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';

    const target = parseInt(el.getAttribute('data-target'), 10);
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1200; // 1.2 seconds: brisk, rapid counting
    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Quartic ease-out: explosive start, silky-smooth finish
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(ease * target);

      el.textContent = `${prefix}${current.toLocaleString('en-US')}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = `${prefix}${target.toLocaleString('en-US')}${suffix}`;
      }
    };

    requestAnimationFrame(frame);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    counterElements.forEach(el => observer.observe(el));
  } else {
    counterElements.forEach(el => animate(el));
  }
}

/**
 * =========================================================================
 * Modal: Consultar Stock de Componentes y Diagnóstico Técnico
 * =========================================================================
 */
window.openDiagModal = function() {
  const badge = document.getElementById('stock-modal-badge');
  const title = document.getElementById('stock-modal-title');
  const desc = document.getElementById('stock-modal-desc');
  const refInput = document.getElementById('stock-referencia');

  if (badge) badge.textContent = 'SOLICITUD DE DIAGNÓSTICO TÉCNICO';
  if (title) title.textContent = 'Solicitar Diagnóstico de Reparación';
  if (desc) desc.textContent = 'Ingresa tus datos y la descripción o modelo de tu equipo. Te enviaremos el procedimiento de recepción y cotización a tu correo.';

  window.openStockModal('Equipo Industrial para Diagnóstico');
  if (refInput) {
    refInput.placeholder = 'Ej: Variador Danfoss FC-302 / Servodrive Siemens / Tarjeta...';
  }
};

window.openStockModal = function(defaultRef) {
  const modal = document.getElementById('stock-modal');
  const form = document.getElementById('stock-form');
  const successBox = document.getElementById('stock-success');
  const refInput = document.getElementById('stock-referencia');
  const badge = document.getElementById('stock-modal-badge');
  const title = document.getElementById('stock-modal-title');
  const desc = document.getElementById('stock-modal-desc');

  if (!modal) return;

  if (form) form.classList.remove('hidden');
  if (successBox) successBox.classList.add('hidden');
  if (form) form.reset();

  if (defaultRef && !defaultRef.includes('Diagnóstico')) {
    if (badge) badge.textContent = 'CONSULTA DE STOCK Y DISPONIBILIDAD';
    if (title) title.textContent = 'Consultar Stock de Componente';
    if (desc) desc.textContent = 'Ingresa tus datos y la referencia que necesitas. Te enviaremos disponibilidad, tiempo de entrega y cotización formal a tu correo.';
    if (refInput) refInput.placeholder = 'Ej: SKM100GB128D / 6ES7...';
  }

  if (refInput && defaultRef) {
    refInput.value = defaultRef;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    const nameInput = document.getElementById('stock-nombre');
    if (nameInput) nameInput.focus();
  }, 100);
};

window.closeStockModal = function() {
  const modal = document.getElementById('stock-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
};

window.handleStockModalBackdrop = function(event) {
  if (event.target && event.target.id === 'stock-modal') {
    window.closeStockModal();
  }
};

window.submitStockForm = async function(event) {
  event.preventDefault();
  const form = document.getElementById('stock-form');
  const submitBtn = document.getElementById('stock-submit-btn');
  const successBox = document.getElementById('stock-success');
  const successMsg = document.getElementById('stock-success-msg');

  const nombre = document.getElementById('stock-nombre')?.value.trim();
  const correo = document.getElementById('stock-correo')?.value.trim();
  const referencia = document.getElementById('stock-referencia')?.value.trim();
  const cantidad = document.getElementById('stock-cantidad')?.value.trim() || '1';
  const telefono = document.getElementById('stock-telefono')?.value.trim() || '';

  if (!nombre || !correo || !referencia) {
    alert('Por favor completa todos los campos requeridos (*)');
    return;
  }

  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="inline-block mr-2 animate-spin">⏳</span><span>Enviando correo...</span>';
  }

  try {
    const payload = {
      nombre,
      correo,
      referencia,
      cantidad: parseInt(cantidad, 10) || 1,
      telefono,
      fecha: new Date().toISOString()
    };

    const res = await fetch('/api/consultar-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Respuesta del servidor stock:', data);

    if (form) form.classList.add('hidden');
    if (successBox) successBox.classList.remove('hidden');
    if (successMsg) {
      successMsg.textContent = `Hemos registrado tu solicitud para "${referencia}" (Cantidad: ${cantidad}). Te enviaremos la cotización a ${correo}.`;
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.warn('Registro local de solicitud de stock:', err);
    if (form) form.classList.add('hidden');
    if (successBox) successBox.classList.remove('hidden');
    if (successMsg) {
      successMsg.textContent = `Hemos registrado tu solicitud para "${referencia}". Te contactaremos en ${correo}.`;
    }
    if (window.lucide) window.lucide.createIcons();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
};

// Popover de Solicitar Diagnóstico (un solo botón verde desplegable)
window.toggleDiagPopover = function(forceState) {
  const popover = document.getElementById('diag-popover');
  const icon = document.getElementById('diag-trigger-icon');
  if (!popover) return;

  const isHidden = popover.classList.contains('hidden');
  const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;

  if (shouldShow) {
    popover.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
    if (window.lucide) window.lucide.createIcons();
  } else {
    popover.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
};

document.addEventListener('click', (e) => {
  const container = document.getElementById('diag-floating-container');
  if (container && !container.contains(e.target)) {
    window.toggleDiagPopover(false);
  }
});

// Cerrar modal y popover con tecla ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeStockModal();
    window.toggleDiagPopover(false);
  }
});

