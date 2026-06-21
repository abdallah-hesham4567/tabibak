document.getElementById('bmiCalcBtn').addEventListener('click', () => {
      const height = parseFloat(document.getElementById('bmiHeight').value);
      const weight = parseFloat(document.getElementById('bmiWeight').value);
      const age = parseInt(document.getElementById('bmiAge').value, 10);
      const gender = document.getElementById('bmiGender').value;
      if (!height || !weight || !age) { alert('يرجى ملء جميع الحقول لحساب مؤشر كتلة الجسم.'); return; }
      displayBMIResult(weight / ((height / 100) ** 2), age, gender);
    });

    function displayBMIResult(bmi, age, gender) {
      const card = document.getElementById('bmiResultCard');
      card.style.display = '';
      let current = 0;
      const target = parseFloat(bmi.toFixed(1));
      const step = target / 30;
      const valueEl = document.getElementById('bmiValue');
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        valueEl.textContent = current.toFixed(1);
        if (current >= target) clearInterval(timer);
      }, 20);

      let cat, catClass, catDesc;
      if (bmi < 18.5) {
        cat = 'نحيف'; catClass = 'underweight';
        catDesc = 'مؤشر كتلة جسمك أقل من النطاق الصحي. يُنصح بزيادة السعرات الحرارية بالأطعمة الغنية بالمغذيات.';
      } else if (bmi < 25) {
        cat = 'وزن طبيعي'; catClass = 'normal';
        catDesc = 'مؤشر كتلة جسمك ضمن النطاق الصحي. حافظ على نمط حياتك الحالي بتغذية متوازنة وتمارين منتظمة.';
      } else if (bmi < 30) {
        cat = 'زيادة وزن'; catClass = 'overweight';
        catDesc = 'مؤشر كتلة جسمك أعلى قليلاً من النطاق الصحي. يُنصح بمزيج من التعديلات الغذائية وزيادة النشاط البدني.';
      } else {
        cat = 'سمنة'; catClass = 'obese';
        catDesc = 'يشير مؤشر كتلة جسمك إلى سمنة. يُنصح باستشارة مقدم الرعاية الصحية لوضع خطة إدارة وزن منظمة.';
      }

      document.getElementById('bmiCircle').className = `bmi-circle ${catClass}`;
      document.getElementById('bmiCatBadge').className = `bmi-cat-badge ${catClass}`;
      document.getElementById('bmiCatBadge').textContent = cat;
      document.getElementById('bmiCatDesc').textContent = catDesc;

      // RTL fix: flip the percentage so the ball moves correctly
      // نحيف (right) = low BMI, سمنة (left) = high BMI
      const pct = Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));
      const rtlPct = 100 - pct;
      setTimeout(() => { document.getElementById('gaugePointer').style.left = `${rtlPct}%`; }, 100);
      const tips = buildBMITips(bmi, age, gender);
      document.getElementById('tipsList').innerHTML = tips.map(t => `<li>${t}</li>`).join('');

      // Save BMI result to STATE and localStorage
      STATE.bmi = {
        value: target,
        category: cat,
        class: catClass,
        age: age,
        gender: gender === 'male' || gender === 'ذكور' || gender === 'ذكر' ? 'ذكر' : 'أنثى'
      };
      try {
        localStorage.setItem('tabibak_bmi', JSON.stringify(STATE.bmi));
      } catch (e) { }

      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function buildBMITips(bmi, age, gender) {
      const tips = [];
      if (bmi < 18.5) {
        tips.push('احرص على تناول 5 إلى 6 وجبات صغيرة خلال اليوم بدلاً من 3 وجبات كبيرة.');
        tips.push('أدرج أطعمة غنية بالسعرات ومغذية: المكسرات والأفوكادو والحبوب الكاملة والبقوليات.');
        tips.push('مارس تمارين مقاومة خفيفة لبناء كتلة عضلية صحية.');
        if (age > 50) tips.push('تحدث مع طبيبك حول كثافة العظام، فانخفاض المؤشر يؤثر على الصحة الهيكلية.');
      } else if (bmi < 25) {
        tips.push('واصل تناول وجبات متوازنة تحتوي على البروتين والكربوهيدرات المعقدة والدهون الصحية.');
        tips.push('احرص على ممارسة 150 دقيقة على الأقل من النشاط الهوائي المعتدل أسبوعياً.');
        tips.push('أعطِ الأولوية لنوم جيد (7-9 ساعات) للحفاظ على الصحة الأيضية.');
        if (gender === 'أنثى') tips.push('احرصي على تناول الكالسيوم والحديد الكافيين، فهما مهمان بشكل خاص للمرأة.');
      } else if (bmi < 30) {
        tips.push('قلّل السكريات المكررة والأطعمة المصنّعة واختر بدائل الأطعمة الكاملة.');
        tips.push('احرص على عجز يومي بالسعرات الحرارية يتراوح بين 300 و500 سعرة مع التمرين.');
        tips.push('المشي 10,000 خطوة يومياً نقطة بداية فعّالة وذات تأثير منخفض.');
        if (age > 40) tips.push('فكّر في فحص القلب والأوعية الدموية، إذ يزيد الوزن الزائد من مخاطر أمراض القلب.');
      } else {
        tips.push('استشر طبيبك قبل البدء بأي برنامج لفقدان الوزن.');
        tips.push('ابدأ بأنشطة منخفضة التأثير (السباحة، ركوب الدراجة) لحماية المفاصل.');
        tips.push('النظام الغذائي المتوسطي يتمتع بأدلة قوية على الفاعلية المستدامة لفقدان الوزن.');
        tips.push('ضع أهدافاً واقعية وتدريجية — فقدان 0.5 إلى 1 كجم أسبوعياً صحي وقابل للاستمرار.');
        if (gender === 'ذكر' && age > 45) tips.push('اطلب فحص دم لمراقبة الكوليسترول وسكر الدم وضغط الدم.');
      }
      return tips;
    }

    document.getElementById('bmiResetBtn').addEventListener('click', () => {
      document.getElementById('bmiResultCard').style.display = 'none';
      ['bmiHeight', 'bmiWeight', 'bmiAge'].forEach(id => document.getElementById(id).value = '');
    });
