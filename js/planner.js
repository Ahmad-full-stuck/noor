/* نُور — مركز التخطيط: قراءة موحّدة للبيانات الأصلية، دون إنشاء مخزن موازٍ. */
(function (w) {
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = v => Array.isArray(v) ? v : [];
  const call = (fn, fallback) => { try { return typeof fn === 'function' ? fn() : fallback; } catch (_) { return fallback; } };
  const stat = (icon, label, value, note) => '<article class="pl-stat"><div class="pl-stat-top"><span>'+label+'</span><span class="pl-stat-icon">'+icon+'</span></div><strong class="pl-stat-value">'+value+'</strong><small>'+note+'</small></article>';
  const act = (name, label, cls, id, extra) => '<button type="button" class="btn '+(cls||'')+'" data-pl="'+esc(name)+'"'+(id==null?'':' data-id="'+esc(id)+'"')+(extra==null?'':' data-extra="'+esc(extra)+'"')+'>'+label+'</button>';
  const empty = (title, desc) => '<div class="pl-empty"><strong>'+title+'</strong><span>'+desc+'</span></div>';
  const bar = pct => '<div class="pl-progress"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div>';
  const fmt = m => { m=Math.max(0,Math.round(Number(m)||0)); const h=Math.floor(m/60),r=m%60; return h&&r?h+' س '+r+' د':h?h+' ساعة':r+' دقيقة'; };
  const isoDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const monday = s => { const d=new Date((s||isoDate(new Date()))+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoDate(d); };

  function read() {
    const S=w.NoorStore;
    if(!S) throw new Error('مخزن نُور لم يكتمل تحميله بعد.');
    const values=list(call(()=>S.getValues(),[])), goals=list(call(()=>S.getGoals(),[]));
    const subs=list(call(()=>S.getSubgoals(),[])), projects=list(call(()=>S.getProjects(),[]));
    const habits=list(call(()=>S.getHabits(),[])), posts=list(call(()=>S.getPosts(),[]));
    const notes=list(call(()=>S.getNotes(),[])), sessions=list(call(()=>S.getSessions(),[]));
    const settings=call(()=>S.getSettings(),{})||{}, today=call(()=>S.todayStr(),isoDate(new Date()));
    const daily=call(()=>S.daily(),{})||{}, tasks=list(daily.tasks);
    const projectTasks=[];
    projects.forEach(p=>list(p.tasks).filter(t=>!t.archived_at).forEach(t=>projectTasks.push(Object.assign({_pid:p.id,_pname:p.name},t))));
    const openProjectTasks=projectTasks.filter(t=>!t.completed_at);
    const booksVideos=projects.filter(p=>['كتاب','فيديو','كورس','دراسة'].includes(p.type)||p.file||p.file_name||p.link||p.video_url||list(p.video_urls).length);
    const knowledgePosts=posts.filter(p=>['knowledge','resources'].includes(p.space)||/كتاب|فيديو|مصدر|معرف/.test(String(p.sub||'')));
    const goalsWithoutSubs=goals.filter(g=>!subs.some(s=>String(s.goal_id)===String(g.id)));
    const projectsWithoutTasks=projects.filter(p=>!p.completed_at&&!list(p.tasks).some(t=>!t.archived_at&&!t.completed_at));
    const projectsWithoutGoal=projects.filter(p=>!p.goal_id&&!p.subgoal_id);
    const unlinkedSources=booksVideos.filter(p=>!p.goal_id&&!p.subgoal_id);
    const sessionsWeek=sessions.filter(s=>(s.mode==='pomodoro'||s.mode==='focus')&&s.date>=monday(today)&&s.date<=today);
    const weekMinutes=sessionsWeek.reduce((n,s)=>n+(Number(s.minutes)||0),0);
    const checks=[
      ['بدء خطة الحياة',!!call(()=>S.hasLifePlan(),false)],
      ['محور/قيمة واحدة على الأقل',values.length>0],
      ['هدف واضح',goals.length>0],
      ['مرحلة لهدف',subs.length>0],
      ['مشروع له نتيجة',projects.length>0],
      ['مصدر أو ملاحظة محفوظة',booksVideos.length+knowledgePosts.length+notes.length>0],
      ['جلسة تركيز مسجلة',sessions.length>0]
    ];
    const setupDone=checks.filter(x=>x[1]).length;
    return {S,values,goals,subs,projects,habits,posts,notes,sessions,settings,today,daily,tasks,projectTasks,openProjectTasks,booksVideos,knowledgePosts,
      goalsWithoutSubs,projectsWithoutTasks,projectsWithoutGoal,unlinkedSources,sessionsWeek,weekMinutes,checks,setupPct:Math.round(100*setupDone/checks.length),
      openToday:tasks.filter(t=>!t.done)};
  }

  function recommendation(d) {
    if(!call(()=>d.S.hasLifePlan(),false)) return {eyebrow:'التأسيس',title:'حدد اتجاهك قبل أن تملأ يومك',body:'افتح النظرة وحدد بداية خطتك ومحاورها. تستطيع إكمال التفاصيل تدريجياً.',label:'فتح النظرة',do:'page',id:'vision'};
    if(!d.values.length) return {eyebrow:'التأسيس',title:'ابدأ بمحور حياة واحد',body:'اختر مجالاً يستحق وقتك، ثم ضع هدفاً محدداً تحته.',label:'إضافة محور/قيمة',do:'value'};
    if(!d.goals.length) return {eyebrow:'التأسيس',title:'اكتب هدفاً واضحاً واحداً',body:'اختر نتيجة تريد الوصول إليها، لا قائمة مهام طويلة.',label:'إنشاء هدف',do:'goal'};
    if(d.goalsWithoutSubs.length){const g=d.goalsWithoutSubs[0];return {eyebrow:'إغلاق فجوة',title:'حوّل «'+g.title+'» إلى مرحلة قابلة للتنفيذ',body:'إضافة مرحلة وسيطة تجعل الهدف أسهل للتحويل إلى مشروع ومهام.',label:'إضافة مرحلة',do:'subgoal',id:g.id};}
    if(!d.projects.length){const s=d.subs[0],g=s&&d.goals.find(x=>String(x.id)===String(s.goal_id));return {eyebrow:'التخطيط للتنفيذ',title:'أنشئ أول مشروع يخدم هدفاً',body:'المشروع له نتيجة يمكن إكمالها. اربطه بمرحلة قائمة بدلاً من تركه منفصلاً.',label:'إنشاء مشروع',do:'project',id:s?s.id:null,extra:g?g.id:null};}
    if(d.projectsWithoutTasks.length){const p=d.projectsWithoutTasks[0];return {eyebrow:'الخطوة التالية',title:'اكتب أول مهمة في «'+p.name+'»',body:'المشروع من دون مهمة تالية يبقى فكرة. اختر فعلاً صغيراً يمكنك تنفيذه.',label:'إضافة مهمة للمشروع',do:'project-task',id:p.id};}
    if(d.openToday.length) return {eyebrow:'التنفيذ اليوم',title:'ابدأ بمهمة واحدة ثم سجّل التركيز',body:'الخطة لا تحتاج المزيد من التفاصيل الآن؛ تحتاج خطوة فعلية وجلسة تركيز مسجلة.',label:'فتح مهام اليوم',do:'page',id:'tasks'};
    return {eyebrow:'المراجعة',title:'حدّث أولوياتك قبل إضافة أعمال جديدة',body:'راجع ما تعثر، واحذف الضجيج من الخطة، ثم اختر نتيجة الأسبوع التالي.',label:'فتح الإحصائيات',do:'page',id:'stats'};
  }

  function setup(d) {
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>تهيئة نُور</h3><p>هذه علامات اكتمال الأساس، وليست درجة على انضباطك.</p></div><strong class="pl-pct">'+d.setupPct+'%</strong></div>'+bar(d.setupPct)+'<div class="pl-steps">'+d.checks.map((c,i)=>'<div class="pl-step '+(c[1]?'done':'')+'"><span class="pl-step-n">'+(c[1]?'✓':String(i+1).padStart(2,'0'))+'</span><span>'+esc(c[0])+'</span><small>'+(c[1]?'مكتمل':'لم يُضف بعد')+'</small></div>').join('')+'</div><div class="pl-cardfoot">'+act('goal','＋ هدف','pl-btn-light')+act('source','＋ مصدر','pl-btn-light')+act('project','＋ مشروع','pl-btn-light')+'</div></section>';
  }

  function mapCard(d) {
    if(!d.values.length&&!d.goals.length) return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>مسار الخطة</h3><p>محور ← هدف ← مرحلة ← مشروع</p></div>'+act('value','ابدأ','pl-btn-main')+'</div>'+empty('الخريطة بانتظار أول عنصر','ابدأ بمحور واحد، واربط به هدفاً ثم مرحلة ومشروعاً.')+'</section>';
    let body=d.values.map(v=>{
      const gs=d.goals.filter(g=>String(g.value_id)===String(v.id));
      return '<article class="pl-domain"><div class="pl-domainhead"><span class="pl-domain-icon">'+esc(v.icon||'◎')+'</span><div><strong>'+esc(v.title)+'</strong><small>'+gs.length+' أهداف</small></div><button class="icon-btn" data-pl="edit-value" data-id="'+esc(v.id)+'" title="تعديل">✎</button></div>'+
      (gs.length?gs.map(g=>{
        const ss=d.subs.filter(s=>String(s.goal_id)===String(g.id)), ids=ss.map(s=>String(s.id));
        const ps=d.projects.filter(p=>String(p.goal_id)===String(g.id)||ids.includes(String(p.subgoal_id)));
        return '<div class="pl-goal"><div class="pl-goalhead"><span class="pl-dot"></span><strong>'+esc(g.title)+'</strong><span class="pl-badge">السنة '+esc(g.year||1)+'</span><button class="icon-btn" data-pl="edit-goal" data-id="'+esc(g.id)+'" title="تعديل الهدف">✎</button></div>'+
          (ss.length?ss.map(s=>{const n=ps.filter(p=>String(p.subgoal_id)===String(s.id)).length;return '<div class="pl-subgoal"><span></span><div>'+esc(s.title)+'<small>'+n+' مشاريع</small></div><button class="icon-btn" data-pl="new-project" data-id="'+esc(s.id)+'" data-extra="'+esc(g.id)+'" title="مشروع ضمن هذه المرحلة">＋</button></div>';}).join(''):'<p class="pl-missing">لا توجد مرحلة مرتبطة بهذا الهدف.</p>')+
          (ps.length?'<div class="pl-projectchips">'+ps.slice(0,3).map(p=>'<span>'+esc(p.name)+(p.completed_at?' · مكتمل':'')+'</span>').join('')+(ps.length>3?'<span>+'+(ps.length-3)+'</span>':'')+'</div>':'')+
          '<div class="pl-inline-actions">'+act('new-subgoal','＋ مرحلة','pl-btn-text',g.id)+'</div></div>';
      }).join(''):'<p class="pl-missing">لا يوجد هدف مرتبط بهذا المحور. '+act('goal-for-value','＋ إنشاء هدف','pl-btn-text',v.id)+'</p>')+'</article>';
    }).join('');
    const loose=d.goals.filter(g=>!d.values.some(v=>String(v.id)===String(g.value_id)));
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>مسار الخطة</h3><p>استعراض سريع لعلاقات نُور الحالية</p></div>'+act('goal','＋ هدف','pl-btn-light')+'</div><div class="pl-hierarchy">'+body+'</div>'+
      (loose.length?'<div class="pl-loose"><strong>أهداف غير مرتبطة بمحور</strong><div>'+loose.map(g=>'<span>'+esc(g.title)+'</span>').join('')+'</div><p>يمكنك ربطها عند تعديل الهدف.</p></div>':'')+
      '<div class="pl-cardfoot">'+act('value','＋ محور/قيمة','pl-btn-light')+act('goal','＋ هدف','pl-btn-light')+act('project','＋ مشروع','pl-btn-light')+'</div></section>';
  }

  function quality(d) {
    const issues=[];
    if(d.goalsWithoutSubs.length) issues.push({title:d.goalsWithoutSubs.length+' أهداف بلا مرحلة',desc:'أضف محطة واضحة قبل إنشاء المزيد من المهام.',do:'subgoal',id:d.goalsWithoutSubs[0].id,btn:'إضافة مرحلة'});
    if(d.projectsWithoutTasks.length) issues.push({title:d.projectsWithoutTasks.length+' مشاريع بلا مهمة قادمة',desc:'ضع خطوة صغيرة قابلة للتنفيذ داخل المشروع.',do:'project-task',id:d.projectsWithoutTasks[0].id,btn:'إضافة مهمة'});
    if(d.projectsWithoutGoal.length) issues.push({title:d.projectsWithoutGoal.length+' مشاريع غير مرتبطة بهدف/مرحلة',desc:'اربطها بنتيجة مفيدة حتى تتضح أولويتها.',do:'page',id:'projects',btn:'مراجعة المشاريع'});
    if(d.unlinkedSources.length) issues.push({title:d.unlinkedSources.length+' مواد مكتبة غير مرتبطة',desc:'اربط المصدر بهدف أو مشروع إن كان يخدمهما.',do:'page',id:'library',btn:'فتح المكتبة'});
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>سلامة الخطة</h3><p>ملاحظات اتساق، لا أحكام على أدائك</p></div><span class="pl-issue-count '+(issues.length?'warn':'ok')+'">'+(issues.length?issues.length+' ملاحظات':'✓ مترابطة')+'</span></div>'+
      (issues.length?'<div class="pl-issues">'+issues.map(i=>'<div class="pl-issue"><span class="pl-issue-mark">!</span><div><strong>'+esc(i.title)+'</strong><p>'+esc(i.desc)+'</p></div>'+act(i.do,i.btn,'pl-btn-light',i.id)+'</div>').join('')+'</div>':empty('لا توجد فجوات واضحة','راجع الروابط أسبوعياً، ولا تضف تفاصيل لا تخدم هدفاً.'))+'</section>';
  }

  function todayCard(d) {
    const rows=d.openToday.slice(0,4);
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>'+(d.daily.weekday?'مهام '+esc(d.daily.weekday):'الخطوة اليومية')+'</h3><p>التنفيذ أهم من مزيد من التخطيط.</p></div>'+act('page','كل المهام ←','pl-btn-text', 'tasks')+'</div>'+
      (rows.length?'<div class="pl-tasklist">'+rows.map(t=>'<div class="pl-taskrow"><span class="pl-taskdot"></span><div><strong>'+esc(t.title||'مهمة بلا عنوان')+'</strong><small>'+esc(t.project_name||'')+(t.carried?' · مُرحّلة':'')+'</small></div><span class="pl-taskstate">'+(t.carried?'مراجعة':'مفتوحة')+'</span></div>').join('')+'</div>':empty('قائمة اليوم مكتملة أو فارغة','افتح مهام اليوم لتحدد الخطوة القادمة، أو خصص وقتاً للمراجعة.'))+
      '<div class="pl-cardfoot">'+act('task','＋ مهمة','pl-btn-light')+act('habit','إدارة العادات','pl-btn-light')+act('page','ابدأ التركيز','pl-btn-main','timer')+'</div></section>';
  }

  function sourcesCard(d) {
    const total=d.booksVideos.length+d.knowledgePosts.length+d.notes.length;
    const recent=d.booksVideos.slice(0,4);
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>المصادر والمعرفة</h3><p>كتب، ملفات، فيديوهات وملاحظات مرتبطة بعملك</p></div><span class="pl-numberbadge">'+total+'</span></div>'+
      '<div class="pl-source-stats"><div><strong>'+d.booksVideos.length+'</strong><small>مواد المكتبة</small></div><div><strong>'+d.knowledgePosts.length+'</strong><small>تدوينات معرفة</small></div><div><strong>'+d.notes.length+'</strong><small>ملاحظات</small></div></div>'+
      (recent.length?'<div class="pl-sourcelist">'+recent.map(p=>'<div class="pl-sourcerow"><span class="pl-sourceicon">'+(p.type==='كتاب'?'▤':p.type==='فيديو'?'▷':'↗')+'</span><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.type||'مصدر')+'</small></div><span class="pl-badge">'+(p.goal_id||p.subgoal_id?'مرتبط':'بلا ربط')+'</span></div>').join('')+'</div>':empty('لا توجد مواد مكتبة بعد','أضف ملفاً أو رابط فيديو أولاً؛ لا يلزم تصنيفه بدقة من أول مرة.'))+
      '<div class="pl-cardfoot">'+act('source','＋ إضافة كتاب/رابط','pl-btn-main')+act('journal','تدوين معرفة','pl-btn-light')+'</div></section>';
  }

  function focusCard(d) {
    return '<section class="card pl-card"><div class="pl-cardhead"><div><h3>التركيز هذا الأسبوع</h3><p>وقت موثق مما نفذته فعلاً</p></div><span class="pl-numberbadge">'+d.sessionsWeek.length+' جلسات</span></div><div class="pl-focus-time">'+fmt(d.weekMinutes)+'</div><div class="pl-subtext">'+d.sessions.length+' جلسة مسجلة كلياً</div><div class="pl-cardfoot">'+act('page','فتح المؤقت','pl-btn-main','timer')+act('page','الإحصائيات','pl-btn-light','stats')+'</div></section>';
  }

  w.renderPlanner = async function () {
    const host=document.getElementById('content'); if(!host)return;
    try{
      const d=read(),r=recommendation(d);
      host.innerHTML='<div class="page-head pl-pagehead"><div><h2 class="page-title">مركز التخطيط</h2><p class="page-sub">من اتجاه حياتك إلى الهدف، ثم المشروع والمهمة والمصدر. هذه لوحة فوق بيانات نُور الأصلية، وليست قاعدة بيانات أخرى.</p></div><div class="pl-headactions">'+act('goal','＋ هدف','btn')+act('source','＋ مصدر','btn btn-lg')+'</div></div>'+
      '<section class="pl-welcome"><div><div class="pl-eyebrow">الصورة الكاملة</div><h2>خطتك، والفجوة التي تحتاج إلى الخطوة التالية</h2><p>اجمع التخطيط والتنفيذ والمراجع في مشهد واحد، ثم عد إلى القسم الأصلي عند التعديل.</p></div><div class="pl-ring"><strong>'+d.setupPct+'%</strong><span>تأسيس الخطة</span></div></section>'+
      '<div class="pl-statgrid">'+stat('◎','محاور/قيم',d.values.length,'الموجود في النظرة')+stat('↗','الأهداف',d.goals.length,d.goalsWithoutSubs.length+' بلا مرحلة')+stat('▤','المشاريع',d.projects.length,d.projectsWithoutTasks.length+' بلا مهمة قادمة')+stat('◷','تركيز الأسبوع',fmt(d.weekMinutes),d.sessionsWeek.length+' جلسات عمل')+'</div>'+
      '<section class="pl-next"><div class="pl-next-icon">↗</div><div class="pl-next-body"><div class="pl-eyebrow">'+esc(r.eyebrow)+'</div><h3>'+esc(r.title)+'</h3><p>'+esc(r.body)+'</p><div class="pl-nextfoot">'+act(r.do,r.label,'pl-btn-main',r.id,r.extra)+'<small>اقتراح يعتمد على بياناتك الحالية؛ لا يغير الخطة أو المواعيد بصمت.</small></div></div></section>'+
      '<div class="pl-columns"><div class="pl-col">'+setup(d)+mapCard(d)+todayCard(d)+'</div><div class="pl-col">'+quality(d)+sourcesCard(d)+focusCard(d)+'<aside class="pl-principle"><strong>قاعدة نُور</strong><p>الخطة الجيدة لا تكتمل بكثرة التفاصيل؛ تكتمل عندما تعرف لماذا تعمل، وما الخطوة التالية، وأين تجد المصدر حين تحتاج إليه.</p></aside></div></div>';
    }catch(e){host.innerHTML='<div class="error-box">تعذر بناء مركز التخطيط: '+esc(e&&e.message||'خطأ غير معروف')+'<div class="pl-cardfoot">'+act('retry','إعادة المحاولة','btn')+act('page','العودة إلى المهام','btn btn-ghost','tasks')+'</div></div>';}
  };

  w.NoorPlannerAction = function (name,id,extra) {
    const n=id==null||id===''?null:Number(id);
    try{
      if(name==='page'&&typeof w.go==='function') return w.go(String(id||'tasks'));
      if(name==='value'&&typeof w.openValueModal==='function') return w.openValueModal();
      if(name==='goal'&&typeof w.openGoalModalForYear==='function') return w.openGoalModalForYear(1);
      if(name==='goal-for-value'&&typeof w.openGoalModal==='function') return w.openGoalModal(null,n);
      if(name==='edit-goal'&&typeof w.openGoalModal==='function') return w.openGoalModal(n);
      if(name==='subgoal'&&typeof w.openSubgoalModal==='function') return w.openSubgoalModal(n);
      if(name==='new-subgoal'&&typeof w.openSubgoalModal==='function') return w.openSubgoalModal(n);
      if(name==='project'&&typeof w.openProjectModal==='function') return w.openProjectModal(null,n,extra==null?null:Number(extra));
      if(name==='new-project'&&typeof w.openProjectModal==='function') return w.openProjectModal(null,n,extra==null?null:Number(extra));
      if(name==='project-task'&&typeof w.openProjectTaskModal==='function') return w.openProjectTaskModal(n);
      if(name==='task'&&typeof w.openTaskModal==='function') return w.openTaskModal();
      if(name==='habit'&&typeof w.openHabitsModal==='function') return w.openHabitsModal();
      if(name==='source'&&typeof w.openLibItemModal==='function') return w.openLibItemModal();
      if(name==='journal'&&typeof w.go==='function') return w.go('journal');
      if(name==='edit-value'&&typeof w.openValueModal==='function') return w.openValueModal(n);
      if(name==='retry'&&typeof w.renderPlanner==='function') return w.renderPlanner();
      if(w.showToast) w.showToast('الأداة المطلوبة غير متاحة في هذه النسخة.','bad');
    }catch(e){if(w.showToast)w.showToast('تعذر فتح الأداة: '+String(e.message||e),'bad');}
  };

  document.addEventListener('click',function(ev){
    const b=ev.target&&ev.target.closest?ev.target.closest('[data-pl]'):null;
    const host=document.getElementById('content');
    if(!b||!host||!host.contains(b)) return;
    ev.preventDefault();
    w.NoorPlannerAction(b.getAttribute('data-pl'),b.getAttribute('data-id'),b.getAttribute('data-extra'));
  });
})(typeof window!=='undefined'?window:globalThis);
