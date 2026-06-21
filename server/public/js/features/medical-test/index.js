    async function extractValuesFromImage(base64Image, apiKey) {
      const extractionPrompt = `أنت نظام OCR لتقارير طبية. اتبع الخطوات بدقة:

الخطوة 1 — المسح: امسح صورة التقرير وحدد الجداول.
الخطوة 2 — التصفية: لكل جدول، قرر إن كان يحتوي على بيانات تحاليل طبية مخبرية أم لا. البيانات الطبية تحتوي على أسماء فحوصات معروفة وقيم رقمية ووحدات قياس (مثل mg/dL، U/L، mmol/L، g/dL، %). إذا كان الجدول لا يحوي بيانات تحاليل طبية مخبرية (مثل جداول مقارنة، مواصفات تقنية، تقييمات)، فتجاهله بالكامل.
الخطوة 3 — الاستخراج: من الجداول الطبية فقط، لكل صف أخرج JSON:
{
  "name": "اسم الاختبار",
  "value": "القيمة الرقمية",
  "unit": "وحدة القياس إن وجدت",
  "normalRange": "النطاق الطبيعي إن وجد"
}
الخطوة 4 — التحقق: عد عناصر المخرجات وتأكد من اكتمالها.

قواعد:
- استخرج كل صف من الجداول الطبية دون استثناء.
- الخلايا الفارغة → استخدم "—".
- لا تستخرج من جداول غير طبية أبداً.
- أخرج JSON array فقط، لا markdown ولا كلمات خارج الهيكل.`;


      const fallbackModels = ['meta-llama/llama-4-scout-17b-16e-instruct'];
      let lastError;
      for (const model of ['llama-3.2-90b-vision-preview', ...fallbackModels]) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model, temperature: 0.15, max_tokens: 4000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: extractionPrompt },
                  { type: 'image_url', image_url: { url: base64Image } }
                ]
              }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل استخراج القيم');
          }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (!raw) throw new Error('لم يرد خادم الاستخراج');
          let clean = raw.replace(/```json|```/g, '').trim();
          const startIdx = clean.indexOf('[');
          const endIdx = clean.lastIndexOf(']');
          if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
          STATE.medicalTest.lastModelUsed = model;
          return safeJsonParse(clean);
        } catch (e) { lastError = e; }
      }
      throw lastError || new Error('فشلت جميع محاولات الاستخراج');
    }

    async function analyzeExtractedValues(values, apiKey) {
      const valuesText = values.map((v, i) =>
        `${i + 1}. ${v.name}: ${v.value} ${v.unit || ''} (الطبيعي: ${v.normalRange || '—'})`
      ).join('\n');

      const analysisPrompt = `أنت محلل سريري خبير. إليك القيم المستخرجة من تقرير التحاليل الطبية:

${valuesText}

اتبع هذه الخطوات بالترتيب:

الخطوة 1 — لكل قيمة، استخدم معرفتك الطبية (المدى الطبيعي القياسي المعروف عالمياً) لتحديد الحالة. تجاهل حقل "الطبيعي" من المدخلات إذا كان ناقصاً أو غير دقيق، واعتمد على خبرتك السريرية. اكتب سطراً واحداً لكل قيمة بالصيغة الآتية التي تظهر المقارنة صراحة:
"[اسم الاختبار] = [القيمة]، الطبيعي: [المدى] → [القيمة] ضمن [المدى] → [طبيعي/مرتفع/منخفض]"

الخطوة 2 — التجميع: نظم القيم حسب الجهاز (صورة دم، كبد، كلى، سكر، دهون، كهرباء، التهابات، أخرى).

الخطوة 3 — التشخيص: لخص النتائج الإجمالية ودلالتها السريرية.

الخطوة 4 — الإخراج: أجب بصيغة JSON صالحة 100% فقط:
{
  "badge": "عنوان قصير لنوع الفحص أو التحليل المكتشف",
  "status": "طبيعي أو غير طبيعي / يحتاج متابعة أو مراجعة طبية عاجلة",
  "statusClass": "green أو orange أو red",
  "analysis": "نص الخطوة 1 + الخطوة 2 + الخطوة 3 مجتمعة",
  "advices": [{ "title": "عنوان", "desc": "شرح" }]
}

هام جداً: كل قيمة من المدخلات يجب أن تظهر في حقل "analysis". أي قيمة مفقودة تعتبر خطأ.`;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 4000,
          messages: [{ role: 'system', content: 'أنت أخصائي تحاليل طبية خبير. أجب بـ JSON فقط.' }, { role: 'user', content: analysisPrompt }]
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'فشل تحليل القيم');
      }
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error('لم يرد خادم التحليل');
      let clean = raw.replace(/```json|```/g, '').trim();
      const startIdx = clean.indexOf('{');
      const endIdx = clean.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
      STATE.medicalTest.lastModelUsed = 'llama-3.3-70b-versatile';
      return safeJsonParse(clean);
    }

    async function getMedicalTestRecsFromAI(base64Image, apiKey) {
      // Step 1: extract raw values from image
      let extracted;
      try {
        extracted = await extractValuesFromImage(base64Image, apiKey);
      } catch (e) {
        console.warn('Extraction failed, falling back to single-pass:', e.message);
      }
      // Step 2: if extraction succeeded, analyze textually; else fall back to one-shot vision
      if (extracted && Array.isArray(extracted) && extracted.length > 0) {
        return await analyzeExtractedValues(extracted, apiKey);
      }
      // Fallback: original single-pass approach
      const promptText = `يرجى قراءة وتحليل صورة التحليل الطبي المرفقة، ثم تقديم استجابة بصيغة JSON صالحة 100% تحتوي على الحقول التالية بالضبط:
{
  "badge": "عنوان قصير لنوع الفحص أو التحليل المكتشف (مثال: صورة دم كاملة CBC، وظائف كبد، إلخ)",
  "status": "طبيعي أو غير طبيعي / يحتاج متابعة أو مراجعة طبية عاجلة",
  "statusClass": "green (للطبيعي)، orange (للمتوسط/متابعة)، red (للحالات غير الطبيعية/طارئة) - اختر واحدة فقط تطابق الحالة",
  "analysis": "شرح تفصيلي، علمي ومبسط باللغة العربية الفصحى للنتائج والقيم الواردة في التحليل وتفسيرها بلغة واضحة للمريض.",
  "advices": [
    {
      "title": "عنوان النصيحة 1",
      "desc": "شرح النصيحة 1 بالتفصيل ومبرراتها الطبية بأسلوب هادئ وواضح"
    },
    {
      "title": "عنوان النصيحة 2",
      "desc": "شرح النصيحة 2 بالتفصيل ومبرراتها الطبية بأسلوب هادئ وواضح"
    },
    {
      "title": "عنوان النصيحة 3",
      "desc": "شرح النصيحة 3 بالتفصيل ومبرراتها الطبية بأسلوب هادئ وواضح"
    }
  ]
}`;
      const fallbackModels = ['meta-llama/llama-4-scout-17b-16e-instruct'];
      let lastError;
      for (const model of ['llama-3.2-90b-vision-preview', ...fallbackModels]) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model, temperature: 0.3, max_tokens: 3000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'أنت أخصائي تحاليل طبية خبير واستشاري سريري. أجب دائماً بـ JSON فقط متطابق مع الهيكل المطلوب دون أي علامات markdown أو نصوص خارج الهيكل.\n\n' + promptText },
                  { type: 'image_url', image_url: { url: base64Image } }
                ]
              }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل الاتصال بخدمة التحليل');
          }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (!raw) throw new Error('لم يرد خادم الذكاء الاصطناعي بأي نتائج');
          let clean = raw.replace(/```json|```/g, '').trim();
          const startIdx = clean.indexOf('{');
          const endIdx = clean.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
          STATE.medicalTest.lastModelUsed = model;
          return safeJsonParse(clean);
        } catch (e) { lastError = e; }
      }
      throw lastError || new Error('فشلت جميع المحاولات');
    }

    async function analyzePdfText(pdfText, apiKey) {
      // Step 1: extract structured values from raw PDF text
      const extractionPrompt = `أنت نظام استخراج بيانات من تقارير طبية. اتبع الخطوات بدقة:

الخطوة 1 — المسح: حدد الجداول في النص التالي.
الخطوة 2 — التصفية: لكل جدول، قرر إن كان يحتوي على بيانات تحاليل طبية مخبرية. البيانات الطبية تحتوي على أسماء فحوصات وقيم رقمية ووحدات قياس. إذا كان الجدول غير طبي، فتجاهله بالكامل.
الخطوة 3 — الاستخراج: من الجداول الطبية فقط، لكل صف أخرج JSON:
{
  "name": "اسم الاختبار",
  "value": "القيمة الرقمية",
  "unit": "وحدة القياس إن وجدت",
  "normalRange": "النطاق الطبيعي إن وجد"
}
الخطوة 4 — التحقق: عد عناصر المخرجات وتأكد من اكتمالها.

قواعد:
- استخرج كل صف من الجداول الطبية فقط.
- الخلايا الفارغة → استخدم "—".
- لا تستخرج من جداول غير طبية أبداً.
- أخرج JSON array فقط.

نص التقرير:
${pdfText}`;

      const extractRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: 'أنت نظام استخراج بيانات من تقارير طبية. أخرج JSON array صالحاً فقط.' },
            { role: 'user', content: extractionPrompt }
          ]
        })
      });
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error?.message || 'فشل استخراج القيم من النص');
      }
      const extractData = await extractRes.json();
      const extractRaw = extractData.choices?.[0]?.message?.content;
      if (!extractRaw) throw new Error('لم يرد خادم الاستخراج');
      let extractClean = extractRaw.replace(/```json|```/g, '').trim();
      const arrStart = extractClean.indexOf('[');
      const arrEnd = extractClean.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd !== -1) extractClean = extractClean.substring(arrStart, arrEnd + 1);
      const values = safeJsonParse(extractClean);
      if (!Array.isArray(values) || values.length === 0) throw new Error('لم يتم استخراج أي قيم');

      return await analyzeExtractedValues(values, apiKey);
    }

    async function convertPdfToImage(pdfDataUrl) {
      try {
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) throw new Error('PDF.js غير محمل');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(pdfDataUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.error('PDF conversion error:', err);
        return null;
      }
    }

    const uploadZone = document.getElementById('medicalTestUploadZone');
    const medicalInput = document.getElementById('medicalTestInput');
    const previewContainer = document.getElementById('medicalTestPreviewContainer');
    const previewImg = document.getElementById('medicalTestPreviewImage');
    const clearImageBtn = document.getElementById('medicalTestClearBtn');
    const analyzeBtn = document.getElementById('medicalTestAnalyzeBtn');
    const uploadBtn = document.getElementById('medicalTestUploadBtn');

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => medicalInput.click());
    }

    if (uploadZone) {
      uploadZone.addEventListener('click', () => medicalInput.click());

      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      });

      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
      });

      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleMedicalImageSelect(e.dataTransfer.files[0]);
        }
      });
    }

    if (medicalInput) {
      medicalInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleMedicalImageSelect(e.target.files[0]);
        }
      });
    }

    if (clearImageBtn) {
      clearImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetMedicalTestImage();
      });
    }

    function handleMedicalImageSelect(file) {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
        return;
      }

      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

      const reader = new FileReader();
      reader.onload = async () => {
        STATE.medicalTest.selectedImage = reader.result;
        STATE.medicalTest.selectedFileIsPdf = isPdf;
        STATE.medicalTest.selectedFileName = file.name;
        STATE.medicalTest.extractedText = '';

        // If PDF, extract text directly
        if (isPdf) {
          try {
            const pdfjsLib = window.pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              const pdf = await pdfjsLib.getDocument(reader.result).promise;
              let fullText = '';
              for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ') + '\n';
              }
              STATE.medicalTest.extractedText = fullText.trim();
            }
          } catch (err) {
            console.warn('PDF text extraction failed:', err);
          }
        }

        const pdfPreview = document.getElementById('medicalTestPdfPreview');
        const pdfNameEl = document.getElementById('medicalTestPdfName');

        if (isPdf) {
          previewImg.style.display = 'none';
          pdfPreview.style.display = '';
          if (pdfNameEl) pdfNameEl.textContent = file.name;
        } else {
          previewImg.style.display = '';
          pdfPreview.style.display = 'none';
          previewImg.src = reader.result;
        }

        previewContainer.style.display = '';
        uploadZone.style.display = 'none';
        analyzeBtn.disabled = false;
        if (clearImageBtn) clearImageBtn.style.display = 'inline-flex';
        if (uploadBtn) uploadBtn.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    function resetMedicalTestImage() {
      STATE.medicalTest.selectedImage = null;
      STATE.medicalTest.selectedFileIsPdf = false;
      STATE.medicalTest.selectedFileName = '';
      STATE.medicalTest.extractedText = '';
      previewImg.src = '';
      previewImg.style.display = '';
      document.getElementById('medicalTestPdfPreview').style.display = 'none';
      previewContainer.style.display = 'none';
      uploadZone.style.display = '';
      analyzeBtn.disabled = true;
      medicalInput.value = '';
      if (clearImageBtn) clearImageBtn.style.display = 'none';
      if (uploadBtn) uploadBtn.style.display = 'inline-flex';
    }

    const analyzeBtnEl = document.getElementById('medicalTestAnalyzeBtn');
    if (analyzeBtnEl) {
      analyzeBtnEl.addEventListener('click', async () => {
        if (!STATE.medicalTest.selectedImage) {
          alert('يرجى تحميل صورة التحليل أولاً.');
          return;
        }

        const apiKey = STATE.medicalTest.apiKey;
        if (!apiKey) {
          alert('عذراً، لم يتم العثور على مفتاح Groq API لتشغيل التحليل بالذكاء الاصطناعي.');
          return;
        }

        const loadingEl = document.getElementById('medicalTestLoading');
        const resultsEl = document.getElementById('medicalTestResults');
        const uploaderEl = document.getElementById('medicalTestUploader');
        const errorEl = document.getElementById('medicalTestError');
        const errorMsgEl = document.getElementById('medicalTestErrorMsg');

        uploaderEl.style.display = 'none';
        resultsEl.style.display = 'none';
        errorEl.style.display = 'none';
        loadingEl.style.display = '';

        try {
          const fallbackKeys = STATE.medicalKeys.length > 0 ? STATE.medicalKeys : STATE.apiKeys;
          let resultData;
          if (STATE.medicalTest.selectedFileIsPdf && STATE.medicalTest.extractedText) {
            // PDF with extracted text → text-only analysis (no vision)
            resultData = await withFallbackKey(analyzePdfText, apiKey, fallbackKeys, STATE.medicalTest.extractedText);
          } else {
            let imageToSend = STATE.medicalTest.selectedImage;
            if (STATE.medicalTest.selectedFileIsPdf) {
              imageToSend = await convertPdfToImage(imageToSend);
              if (!imageToSend) throw new Error('تعذر تحويل PDF إلى صورة');
            }
            resultData = await withFallbackKey(getMedicalTestRecsFromAI, apiKey, fallbackKeys, imageToSend);
          }

          document.getElementById('medicalTestDetectedName').textContent = resultData.badge || 'غير محدد';

          // Show model badge
          const medModelBadge = document.getElementById('medicalTestModelBadge');
          const medModel = STATE.medicalTest.lastModelUsed || '';
          if (medModel.includes('llama-3.3')) {
            medModelBadge.textContent = '🦙 Llama 3.3 70B';
            medModelBadge.style.display = '';
          } else if (medModel.includes('llama-3.2')) {
            medModelBadge.textContent = '🔬 Llama 3.2 90B Vision';
            medModelBadge.style.display = '';
          } else {
            medModelBadge.style.display = 'none';
          }

          const statusBadge = document.getElementById('medicalTestStatusBadge');
          statusBadge.textContent = resultData.status || 'مكتمل';
          statusBadge.className = `medical-status-badge ${resultData.statusClass || 'green'}`;

          document.getElementById('medicalTestAnalysisText').textContent = resultData.analysis || 'لا يوجد تحليل مفصل.';

          const advicesGrid = document.getElementById('medicalTestAdvicesGrid');
          advicesGrid.innerHTML = (resultData.advices || []).map(adv => `
            <div class="advice-card">
              <div class="advice-card-icon"><i class="ti ti-bulb"></i></div>
              <div class="advice-card-content">
                <h4>${adv.title}</h4>
                <p>${adv.desc}</p>
              </div>
            </div>
          `).join('');

          resultsEl.style.display = '';
          STATE.medicalTest.lastResult = resultData;
          // Auto-save to history if logged in
          if (STATE.currentUser) {
            saveMedicalTestSession(resultData);
          }
          document.getElementById('medicalTestSaveBtn').textContent = STATE.currentUser ? '✓ تم الحفظ في السجل' : 'حفظ في السجل';
        } catch (error) {
          console.error("Analysis error:", error);
          errorMsgEl.textContent = `فشل تحليل المستند الطبي: ${error.message || 'خطأ غير معروف'}. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى.`;
          errorEl.style.display = '';
          uploaderEl.style.display = '';
        } finally {
          loadingEl.style.display = 'none';
        }
      });
    }

    const resetBtnEl = document.getElementById('medicalTestResetBtn');
    if (resetBtnEl) {
      resetBtnEl.addEventListener('click', () => {
        document.getElementById('medicalTestResults').style.display = 'none';
        document.getElementById('medicalTestError').style.display = 'none';
        resetMedicalTestImage();
        document.getElementById('medicalTestUploader').style.display = '';
      });
    }

    async function saveMedicalTestSession(resultData) {
      if (!STATE.currentUser) return;
      const session = {
        type: 'medical-test',
        result: JSON.stringify({
          badge: resultData.badge || '',
          status: resultData.status || '',
          statusClass: resultData.statusClass || 'green',
          analysis: resultData.analysis || '',
          advices: resultData.advices || [],
        }),
        details: resultData.badge || 'تحليل طبي',
      };
      try {
        const saved = await api('POST', '/api/sessions', session);
        STATE.sessions.unshift(saved);
      } catch (e) {
        STATE.sessions.unshift({
          id: Date.now(),
          ...session,
          createdAt: new Date().toISOString(),
        });
      }
    }

    async function saveFoodSession() {
      if (!STATE.currentUser) return;
      const foodData = STATE.food.currentData;
      if (!foodData) return;
      const session = {
        type: 'nutrition',
        result: JSON.stringify({
          badge: foodData.badge || '',
          analysis: foodData.analysis || '',
          drugWarnings: foodData.drugWarnings || [],
          cards: foodData.cards || [],
          mood: STATE.food.currentMood || '',
          chatLog: STATE.food.chatLog || [],
        }),
        details: foodData.badge || 'توصيات غذائية',
      };
      try {
        const saved = await api('POST', '/api/sessions', session);
        STATE.sessions.unshift(saved);
        STATE.food.savedSessionId = saved.id;
      } catch (e) {
        const fallback = { id: Date.now(), ...session, createdAt: new Date().toISOString() };
        STATE.sessions.unshift(fallback);
        STATE.food.savedSessionId = fallback.id;
      }
    }

    document.getElementById('medicalTestSaveBtn').addEventListener('click', async () => {
      const resultData = STATE.medicalTest.lastResult;
      if (!resultData) return;
      if (!STATE.currentUser) {
        document.getElementById('medicalTestSaveBtn').textContent = 'سجّل الدخول أولاً';
        setTimeout(() => document.getElementById('medicalTestSaveBtn').textContent = 'حفظ في السجل', 2000);
        return;
      }
      await saveMedicalTestSession(resultData);
      document.getElementById('medicalTestSaveBtn').textContent = '✓ تم الحفظ!';
      setTimeout(() => document.getElementById('medicalTestSaveBtn').textContent = 'حفظ في السجل', 3000);
    });

    document.getElementById('medicalTestPdfBtn').addEventListener('click', () => {
      const resultData = STATE.medicalTest.lastResult;
      if (!resultData) return;
      const date = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const statusColor = resultData.statusClass === 'red' ? '#d32f2f' : resultData.statusClass === 'orange' ? '#f57c00' : '#388e3c';
      const advicesHtml = (resultData.advices || []).map(a =>
        `<div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#f5f5f5;border-radius:8px;border-right:4px solid #1a73e8;">
          <h4 style="margin:0 0 0.25rem;font-size:0.925rem;color:#1a73e8;">${a.title}</h4>
          <p style="margin:0;font-size:0.85rem;color:#555;">${a.desc}</p>
        </div>`
      ).join('');

      const printWin = window.open('', '_blank', 'width=800,height=600');
      printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طبيبك - تقرير تحليل طبي</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">
      ${resultData.badge ? `<meta name="title" content="${resultData.badge.replace(/[<>]/g, '')}">` : ''}
      <style>
        @page { margin: 1.5cm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; direction: rtl; color: #333; line-height: 1.8; padding: 2rem; }
        .header { text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .header h1 { color: #1a73e8; font-size: 1.5rem; }
        .header p { color: #666; font-size: 0.875rem; margin-top: 0.5rem; }
        .badge { display: inline-block; padding: 0.25rem 1rem; border-radius: 20px; font-size: 0.875rem; font-weight: 700; color: #fff; }
        h2 { font-size: 1.25rem; margin-top: 0.75rem; }
        .analysis { margin: 1.5rem 0; line-height: 1.8; font-size: 0.925rem; white-space: pre-wrap; }
        .advices { margin-top: 1.5rem; }
        .advices h3 { font-size: 1rem; margin-bottom: 0.75rem; }
        .footer { border-top: 1px solid #ddd; margin-top: 2rem; padding-top: 1rem; font-size: 0.75rem; color: #999; text-align: center; }
      </style></head><body>
        <div class="header">
          <h1>طبيبك — تقرير تحليل طبي</h1>
          <p>${date}</p>
        </div>
        <div style="margin-bottom:1.5rem;">
          <span class="badge" style="background:${statusColor};">${resultData.status || '—'}</span>
          <h2>${resultData.badge || '—'}</h2>
        </div>
        <div class="analysis">${resultData.analysis || ''}</div>
        ${advicesHtml ? `<div class="advices"><h3>نصائح وإرشادات طبية:</h3>${advicesHtml}</div>` : ''}
        <div class="footer">تم الإنشاء بواسطة طبيبك — الذكاء الاصطناعي للرعاية الصحية. هذه المعلومات ليست تشخيصاً طبياً بديلاً عن استشارة الطبيب.</div>
        <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };<\/script>
      </body></html>`);
      printWin.document.close();
    });
