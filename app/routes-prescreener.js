// app/routes-prescreener.js
// Prototype-only. No validation anywhere by design.

const path = require('path');
const fs = require('fs');

module.exports = function (router) {
  const base = '/researcher/prescreener';

  // ----- Data lookups -------------------------------------------------------
  let CONDITIONS = [];
  let MEDICINES = [];
  try {
    CONDITIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'conditions.json'), 'utf8'));
  } catch (_) {
    CONDITIONS = [];
  }
  try {
    MEDICINES = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'medicines.json'), 'utf8'));
  } catch (_) {
    MEDICINES = [];
  }

  const normalise = (str) => (str || '').toString().trim();
  const splitAliases = (s) => normalise(s).split(',').map((a) => a.trim()).filter(Boolean);

  const conditionCode = new Map(CONDITIONS.map((c) => [String(c.name).toLowerCase(), c.code]));
  const medicineCode  = new Map(MEDICINES.map((m) => [String(m.name).toLowerCase(), m.code]));

  // ----- Session bootstrap ---------------------------------------------------
  router.use((req, res, next) => {
    req.session.data = req.session.data || {};
    req.session.data.prescreener = req.session.data.prescreener || {
      study: { name: '', id: '', arm: '' },
      choices: {
        recruitByConditions: false,
        excludeByConditions: false,
        recruitByMedication: false,
        excludeByMedication: false,
        additionalQuestions: false
      },
      conditions: {
        recruit: { listed: [], custom: [] },
        exclude: { listed: [], custom: [] }
      },
      meds: {
        // listed items have { code, name, aliases[] }
        // custom is array of names; customAliases is { name: [aliases] }
        recruit: { listed: [], custom: [], customAliases: {} },
        exclude: { listed: [], custom: [], customAliases: {} }
      },
      questions: [] // will store [{ text, answerType, exclusion, guidance }]
    };
    next();
  });

  // ----- Start / Study details ----------------------------------------------
  router.get(`${base}/start`, (req, res) => {
    res.render('researcher/prescreener-v1/start');
  });

  router.get(`${base}/study-details`, (req, res) => {
    res.render('researcher/prescreener-v1/study-details');
  });

  router.post(`${base}/study-details`, (req, res) => {
    const { name, id, arm } = req.body.study || {};
    req.session.data.prescreener.study = {
      name: normalise(name),
      id: normalise(id),
      arm: normalise(arm)
    };
    res.redirect(`${base}/choose-methods`);
  });

  // ----- Choose methods ------------------------------------------------------
  router.get(`${base}/choose-methods`, (req, res) => {
    res.render('researcher/prescreener-v1/choose-methods');
  });

  router.post(`${base}/choose-methods`, (req, res) => {
    const c = req.session.data.prescreener.choices;
    c.recruitByConditions = !!req.body.recruitByConditions;
    c.excludeByConditions = !!req.body.excludeByConditions;
    c.recruitByMedication = !!req.body.recruitByMedication;
    c.excludeByMedication = !!req.body.excludeByMedication;
    c.additionalQuestions = !!req.body.additionalQuestions;

    if (c.recruitByConditions) return res.redirect(`${base}/conditions/recruit`);
    if (c.excludeByConditions) return res.redirect(`${base}/conditions/exclude`);
    if (c.recruitByMedication) return res.redirect(`${base}/meds/recruit`);
    if (c.excludeByMedication) return res.redirect(`${base}/meds/exclude`);
    if (c.additionalQuestions) return res.redirect(`${base}/questions`);
    return res.redirect(`${base}/check-answers`);
  });

  // ----- Conditions (recruit/exclude) ---------------------------------------
  function conditionsHandler(kind) {
    return {
      get: (req, res) => res.render(`researcher/prescreener-v1/conditions-${kind}`, { kind }),

      postAddListed: (req, res) => {
        const list = req.session.data.prescreener.conditions[kind].listed;
        const code = normalise(req.body.code);
        const name = normalise(req.body.name);
        if (code && name && !list.find((x) => x.code === code)) list.push({ code, name });
        res.redirect(`${base}/conditions/${kind}`);
      },

      postAddCustom: (req, res) => {
        const custom = req.session.data.prescreener.conditions[kind].custom;
        const name = normalise(req.body.customCondition);
        if (name && !custom.includes(name)) custom.push(name);
        res.redirect(`${base}/conditions/${kind}`);
      },

      postRemoveListed: (req, res) => {
        const i = parseInt(req.params.index, 10);
        if (!Number.isNaN(i)) req.session.data.prescreener.conditions[kind].listed.splice(i, 1);
        res.redirect(`${base}/conditions/${kind}`);
      },

      postRemoveCustom: (req, res) => {
        const i = parseInt(req.params.index, 10);
        if (!Number.isNaN(i)) req.session.data.prescreener.conditions[kind].custom.splice(i, 1);
        res.redirect(`${base}/conditions/${kind}`);
      },

      postContinue: (req, res) => {
        const bucket = req.session.data.prescreener.conditions[kind];

        // Listed from combobox: hidden inputs name="conditions"
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'conditions')) {
          const incoming = Array.isArray(req.body.conditions) ? req.body.conditions : [req.body.conditions];
          incoming.map(normalise).filter(Boolean).forEach((name) => {
            const key = name.toLowerCase();
            if (!bucket.listed.some((i) => (i.name || '').toLowerCase() === key)) {
              bucket.listed.push({ code: conditionCode.get(key) || '', name });
            }
          });
        }

        // Custom from details: hidden inputs name="customConditions"
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'customConditions')) {
          const incomingCustom = Array.isArray(req.body.customConditions)
            ? req.body.customConditions
            : [req.body.customConditions];
          const seen = new Set(bucket.custom.map((c) => c.toLowerCase()));
          incomingCustom.map(normalise).filter(Boolean).forEach((n) => {
            const k = n.toLowerCase();
            if (!seen.has(k)) { seen.add(k); bucket.custom.push(n); }
          });
        }

        const c = req.session.data.prescreener.choices;
        if (kind === 'recruit' && c.excludeByConditions) return res.redirect(`${base}/conditions/exclude`);
        if (kind === 'exclude' && c.recruitByMedication) return res.redirect(`${base}/meds/recruit`);
        if (c.excludeByMedication) return res.redirect(`${base}/meds/exclude`);
        if (c.additionalQuestions) return res.redirect(`${base}/questions`);
        return res.redirect(`${base}/check-answers`);
      }
    };
  }

  const condRecruit = conditionsHandler('recruit');
  const condExclude = conditionsHandler('exclude');

  router.get(`${base}/conditions/recruit`, condRecruit.get);
  router.post(`${base}/conditions/recruit/add-listed`, condRecruit.postAddListed);
  router.post(`${base}/conditions/recruit/add-custom`, condRecruit.postAddCustom);
  router.post(`${base}/conditions/recruit/remove-listed/:index`, condRecruit.postRemoveListed);
  router.post(`${base}/conditions/recruit/remove-custom/:index`, condRecruit.postRemoveCustom);
  router.post(`${base}/conditions/recruit/continue`, condRecruit.postContinue);

  router.get(`${base}/conditions/exclude`, condExclude.get);
  router.post(`${base}/conditions/exclude/add-listed`, condExclude.postAddListed);
  router.post(`${base}/conditions/exclude/add-custom`, condExclude.postAddCustom);
  router.post(`${base}/conditions/exclude/remove-listed/:index`, condExclude.postRemoveListed);
  router.post(`${base}/conditions/exclude/remove-custom/:index`, condExclude.postRemoveCustom);
  router.post(`${base}/conditions/exclude/continue`, condExclude.postContinue);

  // ----- Medicines (recruit/exclude) ----------------------------------------
  function medsHandler(kind) {
    return {
      get: (req, res) => res.render(`researcher/prescreener-v1/medicines-${kind}`),

      // Legacy add/remove endpoints (kept if you still link to them)
      postAddListed: (req, res) => {
        const list = req.session.data.prescreener.meds[kind].listed;
        const code = normalise(req.body.code);
        const name = normalise(req.body.name);
        if (code && name && !list.find((x) => x.code === code)) list.push({ code, name, aliases: [] });
        res.redirect(`${base}/meds/${kind}`);
      },

      postAddCustom: (req, res) => {
        const custom = req.session.data.prescreener.meds[kind].custom;
        const name = normalise(req.body.customMedicine);
        if (name && !custom.includes(name)) custom.push(name);
        res.redirect(`${base}/meds/${kind}`);
      },

      postAliases: (req, res) => {
        const list = req.session.data.prescreener.meds[kind].listed;
        const i = parseInt(req.body.index, 10);
        if (Number.isNaN(i) || !list[i]) return res.redirect(`${base}/meds/${kind}`);
        list[i].aliases = splitAliases(req.body.aliases);
        res.redirect(`${base}/meds/${kind}`);
      },

      postRemoveListed: (req, res) => {
        const i = parseInt(req.params.index, 10);
        if (!Number.isNaN(i)) req.session.data.prescreener.meds[kind].listed.splice(i, 1);
        res.redirect(`${base}/meds/${kind}`);
      },

      postRemoveCustom: (req, res) => {
        const i = parseInt(req.params.index, 10);
        if (!Number.isNaN(i)) req.session.data.prescreener.meds[kind].custom.splice(i, 1);
        res.redirect(`${base}/meds/${kind}`);
      },

      // Single continue handler collects listed, custom and aliases
      postContinue: (req, res) => {
        const bucket = req.session.data.prescreener.meds[kind];
        bucket.customAliases = bucket.customAliases || {};

        // 1) Listed medicines (hidden inputs "medicines")
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'medicines')) {
          const incoming = Array.isArray(req.body.medicines) ? req.body.medicines : [req.body.medicines];
          incoming.map(normalise).filter(Boolean).forEach((name) => {
            const key = name.toLowerCase();
            if (!bucket.listed.some((i) => (i.name || '').toLowerCase() === key)) {
              bucket.listed.push({ code: medicineCode.get(key) || '', name, aliases: [] });
            }
          });
        }

        // 2) Aliases for listed medicines: aliases[MedicineName]
        if (req.body && req.body.aliases && typeof req.body.aliases === 'object') {
          Object.keys(req.body.aliases).forEach((name) => {
            const val = splitAliases(req.body.aliases[name]);
            const idx = bucket.listed.findIndex((m) => (m.name || '').toLowerCase() === name.toLowerCase());
            if (idx > -1) bucket.listed[idx].aliases = val;
          });
        }

        // 3) Custom medicines (hidden inputs "customMedicines")
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'customMedicines')) {
          const incomingC = Array.isArray(req.body.customMedicines) ? req.body.customMedicines : [req.body.customMedicines];
          const seen = new Set(bucket.custom.map((c) => c.toLowerCase()));
          incomingC.map(normalise).filter(Boolean).forEach((n) => {
            const k = n.toLowerCase();
            if (!seen.has(k)) { seen.add(k); bucket.custom.push(n); }
          });
        }

        // 4) Aliases for custom medicines: customAliases[MedicineName]
        if (req.body && req.body.customAliases && typeof req.body.customAliases === 'object') {
          Object.keys(req.body.customAliases).forEach((name) => {
            bucket.customAliases[name] = splitAliases(req.body.customAliases[name]);
          });
        }

        const c = req.session.data.prescreener.choices;
        if (kind === 'recruit' && c.excludeByMedication) return res.redirect(`${base}/meds/exclude`);
        if (c.additionalQuestions) return res.redirect(`${base}/questions`);
        return res.redirect(`${base}/check-answers`);
      }
    };
  }

  const medsRecruit = medsHandler('recruit');
  const medsExclude = medsHandler('exclude');

  router.get(`${base}/meds/recruit`, medsRecruit.get);
  router.post(`${base}/meds/recruit/add-listed`, medsRecruit.postAddListed);
  router.post(`${base}/meds/recruit/add-custom`, medsRecruit.postAddCustom);
  router.post(`${base}/meds/recruit/aliases`, medsRecruit.postAliases);
  router.post(`${base}/meds/recruit/remove-listed/:index`, medsRecruit.postRemoveListed);
  router.post(`${base}/meds/recruit/remove-custom/:index`, medsRecruit.postRemoveCustom);
  router.post(`${base}/meds/recruit/continue`, medsRecruit.postContinue);

  router.get(`${base}/meds/exclude`, medsExclude.get);
  router.post(`${base}/meds/exclude/add-listed`, medsExclude.postAddListed);
  router.post(`${base}/meds/exclude/add-custom`, medsExclude.postAddCustom);
  router.post(`${base}/meds/exclude/aliases`, medsExclude.postAliases);
  router.post(`${base}/meds/exclude/remove-listed/:index`, medsExclude.postRemoveListed);
  router.post(`${base}/meds/exclude/remove-custom/:index`, medsExclude.postRemoveCustom);
  router.post(`${base}/meds/exclude/continue`, medsExclude.postContinue);

  // ----- Questions (simple) --------------------------------------------------
  router.get(`${base}/questions`, (req, res) => {
    const ps = req.session.data.prescreener;
    if (!Array.isArray(ps.questions)) ps.questions = [];
    if (ps.questions.length === 0) {
      ps.questions = [{ text: '', answerType: 'single', exclusion: 'no-exclusion', guidance: '' }];
    }
    res.render('researcher/prescreener-v1/questions');
  });

  // Expect fields: questionText, answerType, exclusion, guidance, __action
  router.post(`${base}/questions/save`, (req, res) => {
    const text = normalise(req.body.questionText);
    const answerType = req.body.answerType === 'multi' ? 'multi' : 'single';
    const exclusion = req.body.exclusion === 'exclude-on-answer' ? 'exclude-on-answer' : 'no-exclusion';
    const guidance = normalise(req.body.guidance);

    req.session.data.prescreener.questions = [{
      text,
      answerType,
      exclusion,
      guidance
    }];

    const next = (req.body.__action === 'continue') ? `${base}/check-answers` : `${base}/questions`;
    res.redirect(next);
  });

  // ----- Check answers / Submit ---------------------------------------------
  router.get(`${base}/check-answers`, (req, res) => {
    res.render('researcher/prescreener-v1/check-answers');
  });

  router.post(`${base}/submit`, (req, res) => {
    req.session.data.prescreener.status = 'submitted';
    res.redirect(`${base}/confirmation`);
  });

  router.get(`${base}/volunteer-view`, (req, res) => {
    res.render('researcher/prescreener-v1/volunteer-view');
  });

  router.get(`${base}/confirmation`, (req, res) => {
    res.render('researcher/prescreener-v1/confirmation');
  });
};
