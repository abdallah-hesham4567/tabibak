const FOOD_FALLBACK = {
      'nausea and upset stomach': {
        badge: 'غثيان / اضطراب المعدة',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['أرز أبيض سادة', 'بسكويت المالح', 'الموز (حمية BRAT)', 'صدر دجاج مسلوق', 'خبز محمص سادة'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['شاي الزنجبيل (مضاد للغثيان)', 'ماء مع إلكتروليتات', 'شاي النعناع'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الأطعمة الحارة', 'الوجبات الدهنية والمقلية', 'منتجات الألبان', 'الكافيين'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['تناوَل كميات صغيرة كل ساعتين', 'اجلس مستقيماً بعد الأكل', 'احتفظ بحلوى الزنجبيل معك', 'تجنَّب الروائح القوية'] },
        ],
      },
      'fever and high body temperature': {
        badge: 'حمى',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['مرق دجاج دافئ', 'بيض مسلوق ناعم', 'شوفان مطبوخ', 'زبادي (بروبيوتيك)'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['ماء (2-3 لتر/يوم)', 'ماء جوز الهند', 'شاي أعشاب', 'محاليل معالجة الجفاف الفموية'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الكحول', 'الكافيين (مدرّ للبول)', 'البروتينات الثقيلة', 'المشروبات السكرية'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['استرح وحافظ على البرودة', 'راقب درجة الحرارة كل 4 ساعات', 'تناوَل الباراسيتامول إذا تجاوزت 38.5°م'] },
        ],
      },
      'headache and migraine': {
        badge: 'صداع / شقيقة',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['اللوز الغني بالمغنيسيوم', 'الشوكولاتة الداكنة (كمية صغيرة)', 'السلمون (أوميغا 3)', 'الخضروات الورقية'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['الكثير من الماء', 'شاي الزنجبيل', 'شاي النعناع', 'مشروبات الإلكتروليتات'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الكحول (خاصة النبيذ الأحمر)', 'الأجبان المعتقة', 'اللحوم المصنّعة (النترات)', 'الأطعمة المحتوية على MSG'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['استرح في غرفة مظلمة وهادئة', 'ضع كمادة باردة/دافئة', 'مارس التنفس العميق'] },
        ],
      },
      'fatigue and low energy': {
        badge: 'إرهاق / انخفاض الطاقة',
        cards: [
          { icon: '<i class="ti ti-meat" style="color:#F97316"></i>', title: 'تناوَل', items: ['لحم خالٍ من الدهن غني بالحديد', 'العدس والبقوليات', 'الكينوا', 'بذور اليقطين'] },
          { icon: '<i class="ti ti-coffee" style="color:#6F4E37"></i>', title: 'اشرب', items: ['الشاي الأخضر (L-theanine)', 'الماء (8 أكواب)', 'ماتشا', 'عصائر السبانخ'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['ارتفاع السكر المفاجئ (حلوى، مشروبات غازية)', 'تخطي الفطور', 'الكحول الزائد', 'الغدا الثقيل'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['نَم 7-9 ساعات ليلاً', 'قم بمشي قصير 10 دقائق', 'افحص مستوى الحديد وفيتامين د'] },
        ],
      },
      default: {
        badge: 'الصحة العامة',
        cards: [
          { icon: '<i class="ti ti-salad" style="color:#22C55E"></i>', title: 'وجبات متوازنة', items: ['نصف الطبق خضروات', 'ربع الطبق بروتين خالٍ من الدهن', 'ربع الطبق حبوب كاملة', 'تنوع الألوان'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'الترطيب', items: ['8 أكواب ماء يومياً', 'شاي أعشاب', 'ماء بالفاكهة', 'حليب منخفض الدسم'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'حدِّد هذه', items: ['الأطعمة فائقة المعالجة', 'السكر المكرر الزائد', 'الدهون المتحولة (المقلية)', 'الصوديوم الزائد'] },
          { icon: '<i class="ti ti-heart-rate-monitor"style="color:#EC4899"></i>', title: 'عادات يومية', items: ['تناوَل الطعام في أوقات منتظمة', '30 دقيقة حركة يومياً', 'الأكل الواعي (بدون شاشات)', 'اقرأ قيم التغذية'] },
        ],
      },
    };


    const GROQ_API_KEY = ''; // loaded dynamically from backend config to prevent git leaks


    async function getFoodRecsFromAI(mood, allKeys) {

      // ── 1. Build user health context from STATE ──────────────
      const user = STATE.currentUser;
      let userContext = '';

      if (user) {
        userContext += '\n\n👤 معلومات المريض الشخصية والتاريخ الطبي:';
        if (user.name) userContext += `\n- الاسم: ${user.name}`;
        if (user.age) userContext += `\n- العمر: ${user.age} سنة`;
        if (user.gender) userContext += `\n- الجنس: ${user.gender === 'male' || user.gender === 'ذكور' || user.gender === 'ذكر' ? 'ذكر' : 'أنثى'}`;
        if (user.history) userContext += `\n- التاريخ المرضي والأمراض المزمنة أو الحساسية: ${user.history}`;
      }

      // Add BMI Context if available
      if (STATE.bmi) {
        userContext += `\n- مؤشر كتلة الجسم الحالي (BMI): ${STATE.bmi.value} (التصنيف: ${STATE.bmi.category})`;
      }

      // Add Breathing Test Context if available
      if (STATE.breathing?.breathResult) {
        const br = STATE.breathing.breathResult;
        userContext += `\n- نتيجة اختبار التنفس الأخير: ${br.title} (الدرجة: ${br.score}/10، التوصية: ${br.desc})`;
      }

      // Active Medications
      if (STATE.meds?.list?.length > 0) {
        userContext += '\n\n💊 الأدوية الحالية التي يتناولها المريض (تنبيه: تحقق من التفاعلات بين الدواء والغذاء والتعارضات):';
        STATE.meds.list.forEach(m => {
          userContext += `\n- ${m.name} ${m.dose || ''} (${m.form || ''}) — إرشادات الطعام: ${m.food || 'غير محدد'}`;
          if (m.note) userContext += ` — ملاحظة إضافية: ${m.note}`;
        });
      }

      // Past symptoms/sessions history
      if (STATE.sessions?.length > 0) {
        userContext += '\n\n🩺 السجل الطبي للجلسات السابقة وأعراض المريض الأخيرة:';
        // Summary of up to 3 past sessions to identify patterns
        const pastSessions = STATE.sessions.slice(0, 3).map(parseSession);
        pastSessions.forEach((s, idx) => {
          userContext += `\nجلسة ${idx + 1}:`;
          if (s.createdAt) userContext += ` التاريخ: ${new Date(s.createdAt).toLocaleDateString('ar-EG')}`;
          if (s.condition) userContext += ` | التشخيص المقدر: ${s.condition}`;
          if (s.symptom) userContext += ` | الأعراض المذكورة: ${s.symptom}`;
          if (s.desc) userContext += ` | الوصف الطبي: ${s.desc}`;
        });
      }

      // ── 2. Build the personalized prompt ─────────────────────
      const hasContext = userContext.length > 0;

      const prompt = `أنت مستشار تغذية محايد تعمل بناءً على الأدلة العلمية فقط. حلل بيانات المستخدم المقدمة أدناه وأصدر توصيات غذائية موضوعية بناءً على المعلومات المتاحة. لا تفترض أي حالة صحية غير مؤكدة. اعتمد فقط على البيانات المقدمة في هذا السياق.

بيانات المستخدم الحالية المتاحة:
${hasContext ? userContext : 'لا تتوفر معلومات صحية سابقة للملف الشخصي.'}

الموضوع / سبب الطلب: "${mood}"

تعليمات:
1. حلل أياً من البيانات التالية إن وُجدت: الأدوية، الحالات المرضية، مؤشر كتلة الجسم، الفحوصات، الأعراض السابقة.
2. إذا وُجدت أدوية: افحص أي تداخل دوائي-غذائي معروف علمياً واذكره في "drugWarnings".
3. في "analysis" اكتب 3-4 جمل تحليلية توضح العلاقة بين البيانات المتاحة والتوصيات (بالعربية الفصحى).
4. في "cards" ضع 4 أقسام كالتالي:
   - "أطعمة مستحبة": أطعمة مفيدة بناءً على البيانات.
   - "مشروبات وسوائل مستحبة": مشروبات مفيدة.
   - "تجنَّب تماماً": أطعمة قد تتعارض مع البيانات.
   - "نصائح نمط الحياة والتغذية العلاجية": إرشادات عامة.
5. كل عنصر في "items" يجب أن يحتوي على "name" و "reason" (سبب علمي مبني على الأدلة).
6. إذا لم تتوفر بيانات كافية، اذكر ذلك بوضوح في التحليل وقدم توصيات عامة متوازنة.
7. أخرج JSON صالحاً مطابقاً للهيكل التالي:

{
  "badge": "عنوان قصير للتوصيات",
  "analysis": "تحليل موضوعي يربط البيانات المتاحة بالتوصيات",
  "drugWarnings": [
    "تحذير دوائي-غذائي إن وجد، أو اكتب 'لا توجد تعارضات معروفة بناءً على البيانات المقدمة'"
  ],
  "cards": [
    {
      "icon": "🥦",
      "title": "أطعمة مستحبة",
      "items": [
        {"name": "طعام", "reason": "السبب العلمي المبني على البيانات المتاحة"}
      ]
    },
    {
      "icon": "🥛",
      "title": "مشروبات وسوائل مستحبة",
      "items": [
        {"name": "مشروب", "reason": "السبب العلمي"}
      ]
    },
    {
      "icon": "🚫",
      "title": "تجنَّب تماماً",
      "items": [
        {"name": "طعام", "reason": "السبب العلمي"}
      ]
    },
    {
      "icon": "💡",
      "title": "نصائح نمط الحياة والتغذية العلاجية",
      "items": [
        {"name": "نصيحة", "reason": "التوجيه المبني على البيانات"}
      ]
    }
  ]
}`;

      // ── 3. Call Groq API — works directly from the browser ───
      async function callGroq(promptText, allKeys) {
        const qwen = 'qwen/qwen3-32b';
        const llama = 'llama-3.3-70b-versatile';
        const pref = STATE.food.preferredModel;
        const primaryKey = allKeys[0];

        const tryModel = async (key, model) => {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              max_tokens: 2000,
              messages: [
                { role: 'system', content: 'أنت مستشار تغذية محايد. حلل البيانات المقدمة وأخرج JSON صالحاً فقط.' },
                { role: 'user', content: promptText },
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('لم يرد Groq بأي محتوى');
            let clean = raw.replace(/```json|```/g, '').trim();
            clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            clean = clean.replace(/<think>/gi, '').trim();
            const jsonStart = clean.indexOf('{');
            const jsonEnd = clean.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              clean = clean.substring(jsonStart, jsonEnd + 1);
            } else {
              throw new Error('الرد لا يحتوي على JSON صالح');
            }
            STATE.food.lastModelUsed = model;
            return { ok: true, data: safeJsonParse(repairJSON(clean)) };
          }
          const err = await res.json().catch(() => ({}));
          const msg = err.error?.message || 'فشل الاتصال';
          if (res.status === 401) return { ok: false, fatal: true, error: new Error('مفتاح Groq غير صحيح') };
          if (res.status === 503) return { ok: false, fatal: true, error: new Error('خدمة Groq غير متاحة مؤقتاً — حاول بعد قليل') };
          if (res.status === 429) return { ok: false, fatal: false };
          return { ok: false, fatal: true, error: new Error(`Groq ${res.status}: ${msg}`) };
        };

        const primaryModel = pref === 'llama' ? llama : qwen;
        const fallbackModel = pref === 'llama' ? qwen : llama;

        // Phase 1: try primary model on all keys
        for (const key of allKeys) {
          const r = await tryModel(key, primaryModel);
          if (r.ok) return r.data;
          if (r.fatal) throw r.error;
        }

        // Phase 2: cycle re-check primary on org1 ↔ fallback on each key
        for (const llmKey of allKeys) {
          const q = await tryModel(primaryKey, primaryModel);
          if (q.ok) return q.data;
          if (q.fatal) throw q.error;
          const f = await tryModel(llmKey, fallbackModel);
          if (f.ok) return f.data;
          if (f.fatal) throw f.error;
        }

        throw new Error('فشلت جميع محاولات الاتصال بالنماذج');
      }

      return await callGroq(prompt, allKeys);
    }

    function renderFoodCards(data, clearChat = true) {
      document.getElementById('foodConditionBadge').textContent = data.badge;

      // Show model badge
      const modelBadge = document.getElementById('foodModelBadge');
      const modelName = STATE.food.lastModelUsed || '';
      if (modelName.includes('qwen')) {
        modelBadge.textContent = '🧠 Qwen 3 32B';
        modelBadge.style.display = '';
      } else if (modelName.includes('llama')) {
        modelBadge.textContent = '🦙 Llama 3.3 70B';
        modelBadge.style.display = '';
      } else {
        modelBadge.style.display = 'none';
      }

      // Render clinical analysis if it exists
      const analysisCard = document.getElementById('foodAnalysisCard');
      const analysisText = document.getElementById('foodAnalysisText');
      if (data.analysis) {
        analysisText.textContent = data.analysis;
        analysisCard.style.display = '';
      } else {
        analysisCard.style.display = 'none';
      }

      // Render drug warnings if they exist and contain active warnings
      const warningsCard = document.getElementById('foodWarningsCard');
      const warningsList = document.getElementById('foodWarningsList');
      const hasWarnings = data.drugWarnings && data.drugWarnings.length > 0 &&
        !data.drugWarnings.every(w => w.includes('لا توجد') || w.toLowerCase().includes('no known') || w.toLowerCase().includes('no interactions'));
      if (hasWarnings && STATE.meds?.list?.length > 0) {
        warningsList.innerHTML = data.drugWarnings.map(w => `<li>${w}</li>`).join('');
        warningsCard.style.display = '';
      } else {
        warningsCard.style.display = 'none';
      }

      // Render cards
      document.getElementById('foodCards').innerHTML = data.cards.map(card => {
        let iconHtml = card.icon;
        if (!iconHtml.includes('<')) {
          iconHtml = `<span>${card.icon}</span>`;
        }

        return `
          <div class="food-card">
            <span class="food-card-icon">${iconHtml}</span>
            <span class="food-card-title">${card.title}</span>
            <ul class="food-card-items">
              ${card.items.map(item => {
          const name = typeof item === 'object' ? item.name : item;
          const reason = typeof item === 'object' ? item.reason : '';
          return `
                  <li>
                    <div class="food-item-wrapper">
                      <span class="food-item-name">${name}</span>
                      ${reason ? `<span class="food-item-reason">${reason}</span>` : ''}
                    </div>
                  </li>
                `;
        }).join('')}
            </ul>
          </div>
        `;
      }).join('');

      document.getElementById('foodResults').style.display = '';

      // Show the food chat area for follow-up modifications
      if (clearChat) {
        document.getElementById('foodChatLog').innerHTML = '';
        document.getElementById('foodChatInput').value = '';
      }
      document.getElementById('foodChatArea').style.display = '';
      document.getElementById('foodActions').style.display = 'flex';
    }

    async function fetchFoodRecommendations(mood) {
      document.getElementById('foodLoading').style.display = '';
      document.getElementById('foodResults').style.display = 'none';
      document.getElementById('foodError').style.display = 'none';
      document.getElementById('foodChatArea').style.display = 'none';
      document.getElementById('foodActions').style.display = 'none';
      STATE.food.chatLog = [];
      STATE.food.currentMood = mood;
      STATE.food.savedSessionId = null;
      try {
        let data;
        if (STATE.food.apiKey) {
          const keys = STATE.apiKeys.length > 0 ? STATE.apiKeys : [STATE.food.apiKey];
          data = await getFoodRecsFromAI(mood, keys);
        } else {
          await new Promise(r => setTimeout(r, 700));
          data = FOOD_FALLBACK[mood] || FOOD_FALLBACK['default'];
        }
        STATE.food.currentData = data;
        renderFoodCards(data);
        if (STATE.currentUser) saveFoodSession();
      } catch (e) {
        document.getElementById('foodErrorMsg').textContent = `خطأ: ${e.message}. جاري عرض التوصيات المدمجة.`;
        document.getElementById('foodError').style.display = '';
        await new Promise(r => setTimeout(r, 300));
        const fallback = FOOD_FALLBACK[mood] || FOOD_FALLBACK['default'];
        STATE.food.currentData = fallback;
        renderFoodCards(fallback);
        if (STATE.currentUser) saveFoodSession();
      } finally {
        document.getElementById('foodLoading').style.display = 'none';
      }
    }

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        STATE.food.selectedMood = chip.dataset.mood;
        document.getElementById('foodCustomInput').value = '';
      });
    });

    document.getElementById('foodModelToggle').addEventListener('click', () => {
      const isLlama = STATE.food.preferredModel === 'llama';
      if (isLlama) {
        STATE.food.preferredModel = '';
        document.getElementById('foodModelIndicator').textContent = '🧠';
        document.getElementById('foodModelLabel').textContent = 'Qwen 3 32B (تلقائي)';
      } else {
        STATE.food.preferredModel = 'llama';
        document.getElementById('foodModelIndicator').textContent = '🦙';
        document.getElementById('foodModelLabel').textContent = 'Llama 3.3 70B';
      }
    });

    document.getElementById('foodGetBtn').addEventListener('click', () => {
      const custom = document.getElementById('foodCustomInput').value.trim();
      const mood = custom || STATE.food.selectedMood;
      if (!mood) { alert('يرجى اختيار شعور أو وصف حالتك.'); return; }
      fetchFoodRecommendations(mood);
    });

    document.getElementById('foodResetBtn').addEventListener('click', () => {
      document.getElementById('foodResults').style.display = 'none';
      document.getElementById('foodChatArea').style.display = 'none';
      document.getElementById('foodActions').style.display = 'none';
      document.getElementById('foodError').style.display = 'none';
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      document.getElementById('foodCustomInput').value = '';
      STATE.food.selectedMood = '';
      STATE.food.currentData = null;
      STATE.food.currentMood = '';
      STATE.food.chatLog = [];
      STATE.food.savedSessionId = null;
      STATE.food.lastModelUsed = '';
      document.getElementById('foodModelBadge').style.display = 'none';
    });

    async function handleFoodChat() {
      const input = document.getElementById('foodChatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      const chatLog = document.getElementById('foodChatLog');

      // Append user message
      const userMsg = document.createElement('div');
      userMsg.style.cssText = 'align-self:flex-end;background:var(--primary);color:white;padding:0.4rem 0.8rem;border-radius:12px 12px 4px 12px;max-width:85%;font-size:0.85rem;word-break:break-word;';
      userMsg.textContent = text;
      chatLog.appendChild(userMsg);

      STATE.food.chatLog.push({ role: 'user', text });

      // Show typing indicator
      const typing = document.createElement('div');
      typing.style.cssText = 'align-self:flex-start;color:var(--text-2);font-size:0.8rem;padding:0.3rem 0;';
      typing.textContent = 'جارٍ تعديل القائمة...';
      chatLog.appendChild(typing);
      chatLog.scrollTop = chatLog.scrollHeight;

      try {
        const currentData = STATE.food.currentData;
        if (!currentData) throw new Error('لا توجد بيانات غذائية حالية');

        const apiKey = STATE.food.apiKey;
        if (!apiKey) {
          // No API key — simple local add/remove simulation
          await new Promise(r => setTimeout(r, 500));
          typing.remove();
          const botMsg = document.createElement('div');
          botMsg.style.cssText = 'align-self:flex-start;background:var(--bubble-bot);color:inherit;padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
          botMsg.textContent = 'عذراً، تعديل القائمة يتطلب اتصالاً بخدمة الذكاء الاصطناعي. يرجى التحقق من مفتاح API.';
          chatLog.appendChild(botMsg);
          chatLog.scrollTop = chatLog.scrollHeight;
          return;
        }

        // Build follow-up prompt with current food data
        const basePrompt = `أنت مستشار تغذية محايد. قام المستخدم بمراجعة خطته الغذائية ويريد تعديلها حسب طلبه.

الخطة الغذائية الحالية (JSON):
${JSON.stringify(currentData, null, 2)}

طلب المستخدم: "${text}"

تعليمات:
1. قيّم الطلب بناءً على البيانات المتاحة في الخطة الحالية.
2. إذا كان الطلب إضافة عنصر جديد: ضعه في الـ card المناسبة حسب عنوانها (title).
3. إذا كان الطلب إزالة عنصر: ابحث عنه في جميع الـ cards واحذفه.
4. إذا كان الطلب غير مناسب أو غير صحي بناءً على التحليل الموضوعي للخطة: أرجِع نفس JSON الأصلي بدون تغيير وأضف حقل "refusal" يشرح سبب الرفض موضوعياً.
5. كل عنصر مضاف يحتوي على "name" و "reason" (سبب موضوعي).
6. أخرج JSON صالحاً مطابقاً للهيكل التالي:

{
  "badge": "...",
  "analysis": "...",
  "drugWarnings": [...],
  "cards": [...],
  "refusal": "سبب الرفض (فقط إذا رفضت الطلب، وإلا فلا تضف هذا الحقل)"
}`;

        async function callFollowUp(promptText, allKeys) {
          const qwen = 'qwen/qwen3-32b';
          const llama = 'llama-3.3-70b-versatile';
          const pref = STATE.food.preferredModel;
          const primaryKey = allKeys[0];

          const tryModel = async (key, model) => {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
              body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 3000,
                messages: [
                  { role: 'system', content: 'أنت مستشار تغذية محايد. أخرج JSON صالحاً فقط.' },
                  { role: 'user', content: promptText },
                ],
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const raw = data.choices?.[0]?.message?.content;
              if (!raw) throw new Error('لم يرد Groq بأي محتوى');

              let clean = raw.replace(/```json|```/g, '').trim();
              clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              clean = clean.replace(/<think>/gi, '').trim();
              const jsonStart = clean.indexOf('{');
              const jsonEnd = clean.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                clean = clean.substring(jsonStart, jsonEnd + 1);
              } else {
                throw new Error('الرد لا يحتوي على JSON صالح');
              }
              const parsed = safeJsonParse(repairJSON(clean));
              if (!parsed.cards || !Array.isArray(parsed.cards)) {
                throw new Error('الاستجابة لا تحتوي على هيكل بطاقات صالح');
              }
              STATE.food.lastModelUsed = model;
              return { ok: true, data: parsed };
            }

            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || 'فشل الاتصال';
            if (res.status === 401) return { ok: false, fatal: true, error: new Error('مفتاح Groq غير صحيح') };
            if (res.status === 429) return { ok: false, fatal: false };
            if (res.status === 503) return { ok: false, fatal: true, error: new Error('خدمة Groq غير متاحة مؤقتاً — حاول بعد قليل') };
            return { ok: false, fatal: true, error: new Error(msg) };
          };

          const primaryModel = pref === 'llama' ? llama : qwen;
          const fallbackModel = pref === 'llama' ? qwen : llama;

          // Phase 1: primary model on all keys
          for (const key of allKeys) {
            const r = await tryModel(key, primaryModel);
            if (r.ok) return r.data;
            if (r.fatal) throw r.error;
          }

          // Phase 2: re-check primary on org1 ↔ fallback on each key
          for (const llmKey of allKeys) {
            const q = await tryModel(primaryKey, primaryModel);
            if (q.ok) return q.data;
            if (q.fatal) throw q.error;
            const f = await tryModel(llmKey, fallbackModel);
            if (f.ok) return f.data;
            if (f.fatal) throw f.error;
          }

          throw new Error('فشلت جميع محاولات الاتصال بالنماذج');
        }

        const followUpKeys = STATE.apiKeys.length > 0 ? STATE.apiKeys : [apiKey];
        const updatedData = await callFollowUp(basePrompt, followUpKeys);

        // Check if the AI refused the request
        if (updatedData.refusal) {
          STATE.food.chatLog.push({ role: 'assistant', text: updatedData.refusal });
          typing.remove();

          const refusalMsg = document.createElement('div');
          refusalMsg.style.cssText = 'align-self:flex-start;background:#fefce8;color:#92400e;padding:0.5rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;border:1px solid #fde68a;';
          refusalMsg.textContent = `⚠️ ${updatedData.refusal}`;
          chatLog.appendChild(refusalMsg);
          chatLog.scrollTop = chatLog.scrollHeight;
          return;
        }

        // Update state and re-render
        STATE.food.currentData = updatedData;
        STATE.food.chatLog.push({ role: 'assistant', text: 'تم تعديل القائمة بنجاح ✓' });
        typing.remove();

        // Append success message
        const botMsg = document.createElement('div');
        botMsg.style.cssText = 'align-self:flex-start;background:var(--bubble-bot);color:inherit;padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
        const modelLabel = STATE.food.lastModelUsed?.includes('qwen') ? '🧠 Qwen' : '🦙 Llama';
        botMsg.textContent = `تم تعديل القائمة ✓ (${modelLabel})`;
        chatLog.appendChild(botMsg);
        chatLog.scrollTop = chatLog.scrollHeight;

        // Update the saved session in-memory
        if (STATE.food.savedSessionId) {
          const idx = STATE.sessions.findIndex(s => s.id === STATE.food.savedSessionId);
          if (idx !== -1) {
            const updatedResult = JSON.stringify({
              badge: updatedData.badge || '',
              analysis: updatedData.analysis || '',
              drugWarnings: updatedData.drugWarnings || [],
              cards: updatedData.cards || [],
              mood: STATE.food.currentMood || '',
              chatLog: STATE.food.chatLog || [],
            });
            STATE.sessions[idx] = { ...STATE.sessions[idx], result: updatedResult, details: updatedData.badge || 'توصيات غذائية' };
          }
        }

        // Re-render food cards with updated data
        renderFoodCards(updatedData, false);

      } catch (e) {
        const typingEl = chatLog.querySelector('div:last-child');
        if (typingEl?.textContent === 'جارٍ تعديل القائمة...') typingEl.remove();

        const errMsg = document.createElement('div');
        errMsg.style.cssText = 'align-self:flex-start;background:var(--red-bg);color:var(--red);padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
        errMsg.textContent = `خطأ: ${e.message}`;
        chatLog.appendChild(errMsg);
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }

    document.getElementById('foodChatSendBtn').addEventListener('click', handleFoodChat);
    document.getElementById('foodChatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFoodChat();
    });

    document.getElementById('foodSaveBtn').addEventListener('click', async () => {
      if (!STATE.currentUser) {
        document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> سجّل الدخول أولاً';
        setTimeout(() => document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> حفظ في السجل', 2000);
        return;
      }
      await saveFoodSession();
      document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-check"></i> تم الحفظ!';
      setTimeout(() => document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> حفظ في السجل', 3000);
    });

    document.getElementById('foodPdfBtn').addEventListener('click', exportFoodPDF);

    function exportFoodPDF() {
      const data = STATE.food.currentData;
      if (!data) return;
      const user = STATE.currentUser;
      const date = new Date().toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      const cardsHtml = data.cards.map(card => {
        const items = card.items.map(item => {
          const name = typeof item === 'object' ? item.name : item;
          const reason = typeof item === 'object' ? item.reason : '';
          return `<li><strong>${name}</strong>${reason ? `<br><small>${reason}</small>` : ''}</li>`;
        }).join('');
        return `<div style="margin-bottom:1.5rem;page-break-inside:avoid;">
          <h3 style="color:#2b6cb0;margin-bottom:0.5rem;font-size:1.1rem;">${card.icon || ''} ${card.title}</h3>
          <ul style="margin:0;padding-right:1.5rem;">${items}</ul>
        </div>`;
      }).join('');

      const chatHtml = (STATE.food.chatLog || []).map(m =>
        `<p style="margin:0.3rem 0;padding:0.3rem 0.6rem;background:${m.role === 'user' ? '#e8f0fe' : '#f5f5f5'};border-radius:6px;"><strong>${m.role === 'user' ? 'المستخدم' : 'المساعد'}:</strong> ${m.text}</p>`
      ).join('');

      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير التوجيه الغذائي</title>
        <style>
          @page { margin: 1.5cm; }
          body { font-family: 'Cairo', Arial, sans-serif; color: #1a1a2e; line-height: 1.7; max-width: 700px; margin: auto; padding: 20px; }
          h1 { color: #2b6cb0; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px; font-size: 22px; }
          h2 { color: #1e4e8c; font-size: 16px; margin-top: 1rem; }
          .meta { color: #666; font-size: 13px; margin-bottom: 1.5rem; }
          .analysis { background: #f0f7ff; padding: 12px; border-radius: 8px; margin-bottom: 1.5rem; }
          .warnings { background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #ffc107; }
          .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
          ul { margin: 0.3rem 0; padding-right: 1.5rem; }
          li { margin-bottom: 0.4rem; }
          small { color: #666; font-size: 12px; }
        </style></head><body>
        <h1>🍽️ تقرير التوجيه الغذائي</h1>
        <div class="meta">
          <p>التاريخ: ${date} ${time}</p>
          ${user?.name ? `<p>المريض: ${user.name}</p>` : ''}
          ${data.badge ? `<p>الخطة: ${data.badge}</p>` : ''}
        </div>
        ${data.analysis ? `<div class="analysis"><strong>التحليل السريري:</strong><br>${data.analysis}</div>` : ''}
        ${data.drugWarnings && data.drugWarnings.length > 0 && !data.drugWarnings.every(w => w.includes('لا توجد')) ? `<div class="warnings"><strong>⚠️ تحذيرات دوائية:</strong><br>${data.drugWarnings.join('<br>')}</div>` : ''}
        <h2>التوصيات الغذائية</h2>
        ${cardsHtml}
        ${chatHtml ? `<h2 style="margin-top:1.5rem;">💬 سجل التعديلات</h2>${chatHtml}` : ''}
        <div class="footer">تم الإنشاء بواسطة طبيبك — الذكاء الاصطناعي المساعد للرعاية الصحية<br>هذا التقرير ليس تشخيصاً طبياً بديلاً عن استشارة الطبيب المختص.</div>
        <script>window.print();window.close();<\/script>
      </body></html>`);
      win.document.close();
    }

    // API key is set in STATE.food.apiKey — no user UI needed
