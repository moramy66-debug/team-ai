# Team AI — منصة العمل الهندسية متعددة الوكلاء (Multi-Agent AI Workspace)

[<kbd>Live Demo</kbd>](https://moramy66-debug.github.io/team-ai/) [<kbd>Check Page</kbd>](https://moramy66-debug.github.io/team-ai/check.html) [<kbd>Version: v122</kbd>](./CHANGELOG.md) [<kbd>License: MIT</kbd>](./LICENSE) <kbd>PWA Offline Ready</kbd> <kbd>Zero-Build Vanilla JS</kbd>

تطبيق ويب تقدمي (**PWA**) يعمل بالكامل من المتصفح بواجهة عربية (**RTL**) مبنية بتقنيات **Zero-Build Vanilla HTML/CSS/JS** لتنسيق فرق الوكلاء الذكيين ومراجعة المشاريع الهندسية بدقة واحترافية.

## روابط التشغيل المباشر
- **التشغيل المباشر (Live App):** https://moramy66-debug.github.io/team-ai/
- **صفحة الفحص والتحقق (System Check):** https://moramy66-debug.github.io/team-ai/check.html

## المميزات الرئيسية
- **البث المباشر (Streaming):** عرض ردود الوكلاء وتحديث التقارير بشكل فوري ولحظي أثناء التوليد.
- **التحقق من الحسابات والمراجع:** مراجعة آلية للأرقام والمعادلات الهندسية ومطابقتها مع المراجع والأكواد المعتمدة.
- **دعم متعدد المزودين:** Google Gemini، Groq، OpenRouter، OpenAI، وAnthropic Claude.
- **منسق فريق متكامل (`RCK.steps`):** تنفيذ خطوات متعددة من الفهم الأولي (`stepF0`) إلى المراجعة والتدقيق والتقرير النهائي.
- **Code Ref (`data/code-library.json` + `js/code-library.js`):** مرجع أكواد SBC 401 وSEC من 10 مدخلات، كل مدخل بحالة `verified_mirror` أو `needs_review` ورابط مصدر. مدخلات SEC الموثقة خاصة بمحطات Solar PV أكبر من 2 MW فقط.
- **Eng Calc:** تبويبات Lighting وCable Tray وTransformer وGenerator وPFC وCPC وSLD وLoad Schedule وSubmittal، إضافة إلى حاسبة القصر والمحركات.
- **مكتبة الأكواد الهندسية (`codes-data.json`):** دعم مدمج للأكواد الهندسية (`SBC 401`، `IEC 60364`، `SEC DPS`) مع إمكانية رفع ملفات مرجعية مخصصة.
- **أدوات احترافية (`js/pro-tools.js`):** حاسبة هندسية سريعة، ترويسة مكتب قابلة للتخصيص، نسخ احتياطي واستعادة (JSON)، ودليل استخدام سريع (`?`).
- **الوضع الفاتح والداكن (Light / Dark Mode):** تبديل سلس بين المظهر الفاتح والداكن مع حفظ التفضيل تلقائياً.
- **تنسيق الطباعة الاحترافي:** إخراج مخصص للطباعة وحفظ PDF يخفي القوائم الجانبية ويبرز التقرير والترويسة.
- **قراءة وتصدير الملفات:** استيراد PDF عبر `pdf.js` وملفات Excel عبر `XLSX`، وتصدير التقارير إلى PDF وExcel أو إرسالها عبر البريد (`EmailJS`).
- **تطبيق ويب تقدمي (PWA):** يعمل دون اتصال عبر `manifest.webmanifest` و`sw.js`.

## هيكل المشروع
```text
team-ai/
├── index.html              # الواجهة الرئيسية للتطبيق
├── check.html              # صفحة فحص النظام والتحقق من المكونات
├── preview.html            # صفحة المعاينة
├── codes-data.json         # قاعدة بيانات الأكواد الهندسية المدمجة
├── manifest.webmanifest    # ملف تعريف تطبيق الويب التقدمي (PWA)
├── sw.js                   # Service Worker للتخزين المؤقت (teamai-v122)
├── CHANGELOG.md            # سجل التغييرات والإصدارات
├── LICENSE                 # رخصة MIT
├── css/
│   └── styles.css          # التنسيقات، الوضع الفاتح/الداكن، الطباعة، وتنسيق Code Ref
├── data/
│   ├── eng-tables.json     # 24 جدولاً هندسياً (status وsource لكل جدول)
│   └── code-library.json   # مرجع SBC 401 / SEC (10 مدخلات)
├── js/
│   ├── app.js              # نواة التطبيق وإدارة الواجهة
│   ├── orchestrator.js     # منسق الوكلاء والبث المباشر والتحقق
│   ├── code-library.js     # لوحة Code Ref
│   ├── code-search.js      # محرك البحث في الأكواد الهندسية
│   ├── codes-and-templates.js # إدارة القوالب والأكواد
│   ├── files-and-export.js # استيراد وتصدير PDF وExcel
│   ├── pro-tools.js        # الترويسة، النسخ الاحتياطي، والدليل السريع
│   ├── sanitize.js         # تنقية وتأمين مخرجات HTML
│   ├── storage-idb.js      # التخزين المحلي عبر IndexedDB
│   ├── team-extras.js      # إضافات وتخصيصات الفريق
│   ├── ui-tidy.js          # قائمة More وتنظيف الشريط العلوي
│   └── eng-*.js            # وحدات Eng Calc (calc, tables, ui, shortcircuit-ui, crosscheck, pdf, lighting, cabletray, transformer, generator, pfc-cpc, sld, loadschedule, submittal)
├── tools/                  # اختبارات Node (*-test.js) وdupcheck، تعمل في GitHub Actions (lint.yml)
├── docs/                   # نصوص المهام (prompts)
└── worker/                 # ملفات العامل السحابي
```

## حالة التطبيق في الإصدار v122

- **`data/eng-tables.json`**: 24 جدولاً هندسياً (آخرها جدول I2t)، لكل منها `status` و`source` من مرايا عامة. الحالة القصوى `verified_secondary`، وما لا يمكن توثيقه يبقى `needs_review`.
- **`data/code-library.json`**: 10 مدخلات (3 `verified_mirror` و7 `needs_review` بدون أرقام بوحدات). مدخلا SEC الموثقان يخصان Solar PV أكبر من 2 MW فقط.
- **Eng Calc**: Lighting وCable Tray وTransformer وGenerator وPFC وCPC وSLD وLoad Schedule وSubmittal، مع `cross-check` وتصدير PDF بصيغة صور A4.
- **الاختبارات**: ملفات `tools/*-test.js` وفحص `dupcheck` (بوضع STRICT) وفحص syntax لـ `sw.js`، كلها في `lint.yml`.
- **ملاحظة**: الاختبارات حسابية وبنيوية ولا تثبت صحة المراجع نفسها؛ كل رقم غير موثق من مصدر عام يبقى `needs_review`.

## التشغيل المحلي
```bash
python3 -m http.server 8080
```
ثم افتح المتصفح على `http://localhost:8080`.
