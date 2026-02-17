/**
 * Dune: Awakening — Damage Calculator
 * State, calculation, and DOM wiring.
 */

// ─── State ───────────────────────────────────────────────────────────────────
let selectedType = 'blade';

const DAMAGE_TYPES = {
  blade:      { label: 'Blade',       mitKey: 'mit_blade',       hasDot: false, pureDoT: false, dotKey: null,           color: '#e84040' },
  lightdart:  { label: 'Light Dart',  mitKey: 'mit_lightdart',   hasDot: false, pureDoT: false, dotKey: null,           color: '#40a0e8' },
  heavydart:  { label: 'Heavy Dart',  mitKey: 'mit_heavydart',   hasDot: false, pureDoT: false, dotKey: null,           color: '#1a6fbe' },
  concussive: { label: 'Concussive',  mitKey: 'mit_concussive',  hasDot: false, pureDoT: false, dotKey: null,           color: '#e86030' },
  energy:     { label: 'Energy',      mitKey: 'mit_energy',      hasDot: false, pureDoT: false, dotKey: null,           color: '#a040e8' },
  fire:       { label: 'Fire',        mitKey: 'mit_fire_impact', hasDot: true,  pureDoT: false, dotKey: 'mit_fire_dot',  color: '#ff5520' },
  poison:     { label: 'Poison',      mitKey: null,              hasDot: true,  pureDoT: true,  dotKey: 'mit_poison',    color: '#60cc30' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getVal(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) || 0 : 0;
}

function fmt(n, dec = 1) {
  if (isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(dec);
}

function selectDmgType(btn) {
  document.querySelectorAll('.dmg-btn').forEach(b => {
    b.classList.remove('selected');
    b.style.borderColor = '';
    b.style.color = '';
    b.style.background = '';
  });
  const type = btn.dataset.type;
  const info = DAMAGE_TYPES[type];
  btn.classList.add('selected');
  btn.style.borderColor = info.color;
  btn.style.color = '#fff';
  btn.style.background = `${info.color}22`;
  selectedType = type;

  const splitWrap = document.getElementById('dotSplitWrap');
  const poisonNote = document.getElementById('poisonNote');
  if (splitWrap) splitWrap.style.display = (info.hasDot && !info.pureDoT) ? 'block' : 'none';
  if (poisonNote) poisonNote.style.display = info.pureDoT ? 'block' : 'none';

  calculate();
}

function onPvPToggle() {
  const checkbox = document.getElementById('pvpToggle');
  const checked = checkbox ? checkbox.checked : false;
  const pvpSub = document.getElementById('pvpSub');
  const pvpLabel = document.getElementById('pvpLabel');
  if (pvpSub) pvpSub.classList.toggle('visible', checked);
  if (pvpLabel) pvpLabel.classList.toggle('active', checked);
  calculate();
}

// ─── Main Calculation ─────────────────────────────────────────────────────────
function calculate() {
  const armor = getVal('armorValue');
  const rawDamage = getVal('rawDamage');
  const pvpToggle = document.getElementById('pvpToggle');
  const headShotToggle = document.getElementById('headShotToggle');
  const pvpEnabled = pvpToggle ? pvpToggle.checked : false;
  const isHeadshot = pvpEnabled && headShotToggle && headShotToggle.checked;
  const canHeadshot = !['poison', 'concussive'].includes(selectedType);
  const pvpReductionPct = pvpEnabled ? (isHeadshot && canHeadshot ? 60 : 40) : 0;

  const typeInfo = DAMAGE_TYPES[selectedType];

  const armorDR = armor / (armor + 500);
  const armorDRpct = armorDR * 100;

  const armorPct = document.getElementById('armorPct');
  const ehpMultiplier = document.getElementById('ehpMultiplier');
  const drBarFill = document.getElementById('drBarFill');
  if (armorPct) armorPct.textContent = armorDRpct.toFixed(1) + '%';
  if (ehpMultiplier) ehpMultiplier.textContent = (1 / (1 - armorDR)).toFixed(2) + '×';
  if (drBarFill) drBarFill.style.width = Math.min(100, (armorDRpct / 90) * 100) + '%';

  const pvpMult = pvpEnabled ? (1 - pvpReductionPct / 100) : 1;
  const typeMit = typeInfo.mitKey ? getVal(typeInfo.mitKey) / 100 : 0;
  const specDR = getVal('specDR') / 100;

  let impactDamage = 0;
  let impactRaw = rawDamage;

  if (!typeInfo.pureDoT) {
    const impactPortion = (typeInfo.hasDot && !typeInfo.pureDoT)
      ? getVal('dotSplitImpact') / 100
      : 1;
    impactRaw = rawDamage * impactPortion;
    const afterPvP = impactRaw * pvpMult;
    const afterArmor = afterPvP * (1 - armorDR);
    const afterType = afterArmor * (1 - typeMit);
    impactDamage = afterType * (1 - specDR);
  }

  let dotRaw = 0, dotReduced = 0, dotResistPct = 0;
  const showDot = typeInfo.hasDot;

  if (typeInfo.hasDot) {
    const dotPortion = typeInfo.pureDoT ? 1 : getVal('dotSplitDot') / 100;
    dotRaw = rawDamage * dotPortion;
    const dotResist = typeInfo.dotKey ? getVal(typeInfo.dotKey) / 100 : 0;
    dotResistPct = dotResist * 100;
    const afterPvP = dotRaw * pvpMult;
    dotReduced = afterPvP * (1 - dotResist) * (1 - specDR);
  }

  let effectiveDRpct = 0;
  if (!typeInfo.pureDoT) {
    const impactPortion = typeInfo.hasDot ? getVal('dotSplitImpact') / 100 : 1;
    const effective = 1 - (impactDamage / ((rawDamage * impactPortion) * pvpMult + 0.0001));
    effectiveDRpct = effective * 100;
  }

  const totalDamage = typeInfo.pureDoT ? dotReduced : impactDamage;
  const damageBlocked = typeInfo.pureDoT
    ? (rawDamage - dotReduced)
    : (rawDamage * (typeInfo.hasDot ? getVal('dotSplitImpact') / 100 : 1)) * pvpMult - impactDamage;

  const impactPortionForEhp = typeInfo.hasDot ? getVal('dotSplitImpact') / 100 : 1;
  const ehp = typeInfo.pureDoT
    ? (100 / Math.max(0.001, dotReduced / rawDamage))
    : (100 / Math.max(0.001, impactDamage / (rawDamage * impactPortionForEhp)));

  const resDamageTaken = document.getElementById('resDamageTaken');
  const resDamageSub = document.getElementById('resDamageSub');
  const resTotalDR = document.getElementById('resTotalDR');
  const resDamageBlocked = document.getElementById('resDamageBlocked');
  const resEHP = document.getElementById('resEHP');
  const resEHPSub = document.getElementById('resEHPSub');
  if (resDamageTaken) resDamageTaken.textContent = fmt(totalDamage);
  if (resDamageSub) resDamageSub.textContent = typeInfo.pureDoT ? 'per DoT tick' : 'per hit';
  if (resTotalDR) resTotalDR.textContent = typeInfo.pureDoT ? fmt(dotResistPct) + '%' : fmt(effectiveDRpct) + '%';
  if (resDamageBlocked) resDamageBlocked.textContent = fmt(damageBlocked);
  if (resEHP) resEHP.textContent = fmt(ehp, 0);
  if (resEHPSub) resEHPSub.textContent = 'effective HP vs this type';

  const dotSection = document.getElementById('dotSection');
  if (dotSection) dotSection.classList.toggle('visible', showDot);
  if (showDot) {
    const dotRawTick = document.getElementById('dotRawTick');
    const dotReducedTick = document.getElementById('dotReducedTick');
    const dotResistPctEl = document.getElementById('dotResistPct');
    if (dotRawTick) dotRawTick.textContent = fmt(dotRaw * pvpMult);
    if (dotReducedTick) dotReducedTick.textContent = fmt(dotReduced);
    if (dotResistPctEl) dotResistPctEl.textContent = fmt(dotResistPct) + '%';
    const dotColor = selectedType === 'poison' ? '#60cc30' : selectedType === 'energy' ? '#a040e8' : '#ff5520';
    dotSection.style.borderColor = dotColor + '44';
    if (dotRawTick) dotRawTick.style.color = dotColor;
  }

  const steps = [];
  if (pvpEnabled) {
    const shotLabel = (isHeadshot && canHeadshot) ? 'Headshot (−60%)' : 'Body Shot (−40%)';
    steps.push({
      label: `PvP reduction — ${shotLabel}`,
      eq: `${fmt(rawDamage)} × ${fmt(pvpMult * 100)}% = ${fmt(rawDamage * pvpMult)}`,
      value: fmt(rawDamage * pvpMult),
    });
  }
  if (!typeInfo.pureDoT) {
    const impactAfterPvP = rawDamage * (typeInfo.hasDot ? getVal('dotSplitImpact') / 100 : 1) * pvpMult;
    steps.push({
      label: `Armor DR (${fmt(armorDRpct)}%)`,
      eq: `${fmt(impactAfterPvP)} × ${fmt(1 - armorDR, 3)} = ${fmt(impactAfterPvP * (1 - armorDR))}`,
      value: fmt(impactAfterPvP * (1 - armorDR)),
    });
    if (Math.abs(typeMit) > 0.0001) {
      const afterArmor2 = impactAfterPvP * (1 - armorDR);
      steps.push({
        label: `${typeInfo.label} mitigation (${typeMit >= 0 ? '-' : '+'}${fmt(Math.abs(typeMit * 100))}%)`,
        eq: `${fmt(afterArmor2)} × ${fmt(1 - typeMit, 3)} = ${fmt(afterArmor2 * (1 - typeMit))}`,
        value: fmt(afterArmor2 * (1 - typeMit)),
      });
    }
    if (specDR > 0.0001) {
      const beforeSpec = impactAfterPvP * (1 - armorDR) * (1 - typeMit);
      steps.push({
        label: `Combat Spec DR (−${fmt(specDR * 100)}%)`,
        eq: `${fmt(beforeSpec)} × ${fmt(1 - specDR, 3)} = ${fmt(beforeSpec * (1 - specDR))}`,
        value: fmt(beforeSpec * (1 - specDR)),
      });
    }
    steps.push({
      label: '⟶ Impact damage taken',
      eq: '',
      value: fmt(impactDamage),
      highlight: true,
    });
  }
  if (showDot) {
    const dotAfterPvP = rawDamage * (typeInfo.pureDoT ? 1 : getVal('dotSplitDot') / 100) * pvpMult;
    steps.push({
      label: 'DoT: Armor DR skipped',
      eq: `DoT ${fmt(dotAfterPvP)} (armor DR does not apply)`,
      value: '',
    });
    if (dotResistPct !== 0) {
      const dotBeforeSpec = dotAfterPvP * (1 - dotResistPct / 100);
      steps.push({
        label: `DoT resistance (${fmt(dotResistPct)}%)`,
        eq: `${fmt(dotAfterPvP)} × ${fmt(1 - dotResistPct / 100, 3)} = ${fmt(dotBeforeSpec)}`,
        value: fmt(dotBeforeSpec),
      });
    }
    if (specDR > 0.0001) {
      const dotBeforeSpec = dotAfterPvP * (1 - dotResistPct / 100);
      steps.push({
        label: `Combat Spec DR (−${fmt(specDR * 100)}%)`,
        eq: `${fmt(dotBeforeSpec)} × ${fmt(1 - specDR, 3)} = ${fmt(dotReduced)}`,
        value: fmt(dotReduced),
      });
    }
    steps.push({
      label: '⟶ DoT damage per tick',
      eq: '',
      value: fmt(dotReduced),
      highlight: true,
      dotStyle: true,
    });
  }

  const stepsHTML = steps
    .map(
      (s) => `
    <div class="breakdown-step">
      <span class="step-arrow">▶</span>
      <span class="step-label" style="${s.highlight ? 'color:var(--text-primary);font-weight:600' : ''}">${s.label}</span>
      <span class="step-eq">${s.eq}</span>
      <span class="step-value" style="${s.dotStyle ? 'color:var(--fire)' : s.highlight ? 'color:var(--amber-glow)' : ''}">${s.value}</span>
    </div>
  `
    )
    .join('');
  const breakdownSteps = document.getElementById('breakdownSteps');
  if (breakdownSteps) breakdownSteps.innerHTML = stepsHTML;
}

// ─── Bind events & init ──────────────────────────────────────────────────────
function init() {
  const dotSplitImpact = document.getElementById('dotSplitImpact');
  if (dotSplitImpact) {
    dotSplitImpact.addEventListener('input', function () {
      const v = Math.min(100, Math.max(0, parseFloat(this.value) || 0));
      const dotSplitDot = document.getElementById('dotSplitDot');
      if (dotSplitDot) dotSplitDot.value = (100 - v).toFixed(0);
      calculate();
    });
  }

  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.addEventListener('input', calculate);
  });

  const pvpToggle = document.getElementById('pvpToggle');
  if (pvpToggle) pvpToggle.addEventListener('change', onPvPToggle);

  const headShotToggle = document.getElementById('headShotToggle');
  if (headShotToggle) headShotToggle.addEventListener('change', calculate);

  document.querySelectorAll('.dmg-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      selectDmgType(this);
    });
  });

  const bladeBtn = document.querySelector('[data-type="blade"]');
  if (bladeBtn) {
    bladeBtn.style.borderColor = '#e84040';
    bladeBtn.style.color = '#fff';
    bladeBtn.style.background = '#e8404022';
  }

  calculate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
