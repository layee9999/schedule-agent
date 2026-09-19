(function bootstrapOverlay() {
  if (document.getElementById('schedule-agent-root')) return

  var script = document.currentScript
  var origin = script && script.src ? new URL(script.src).origin : 'http://localhost:5173'

  var wrap = document.createElement('div')
  wrap.id = 'schedule-agent-root'
  wrap.innerHTML =
    '<button id="schedule-agent-toggle" title="课表智能体">AI</button>' +
    '<iframe id="schedule-agent-frame" title="课表服务智能体"></iframe>'
  wrap.querySelector('#schedule-agent-frame').src = origin + '/assistant?embed=1'
  document.body.appendChild(wrap)

  var style = document.createElement('style')
  style.textContent =
    '#schedule-agent-root{position:fixed;right:20px;bottom:20px;z-index:2147483646;font-family:sans-serif}' +
    '#schedule-agent-toggle{width:56px;height:56px;border:0;border-radius:50%;background:#3D7BFF;color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(61,123,255,.35);cursor:pointer}' +
    '#schedule-agent-frame{display:none;position:absolute;right:0;bottom:68px;width:390px;height:min(740px, calc(100vh - 100px));border:0;border-radius:28px;box-shadow:0 18px 50px rgba(20,40,80,.28);background:#fff}' +
    '#schedule-agent-root.open #schedule-agent-frame{display:block}'
  document.head.appendChild(style)

  wrap.querySelector('#schedule-agent-toggle').addEventListener('click', function () {
    wrap.classList.toggle('open')
  })

  function formBody(data) {
    return Object.keys(data)
      .map(function (key) {
        var value = data[key]
        if (value === undefined || value === null) return ''
        return encodeURIComponent(key) + '=' + encodeURIComponent(String(value))
      })
      .filter(Boolean)
      .join('&')
  }

  function weeksFromRange(start, end) {
    var list = []
    for (var i = start; i <= end; i += 1) list.push(String(i))
    return list.join(',')
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }

  function currentWeek() {
    var weekEl = document.querySelector('.selectBox .week')
    return (weekEl && weekEl.getAttribute('week')) || (window.Schedule && Schedule.curriculum && Schedule.curriculum.currentWeek) || ''
  }

  function reloadSchedule() {
    try {
      localStorage.setItem('op', '1')
      var week = currentWeek()
      if (window.Schedule && typeof Schedule.loadLessons === 'function') Schedule.loadLessons(week)
    } catch (err) {}
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return
    var msg = event.data || {}
    if (!msg.id || !msg.type) return
    var frame = wrap.querySelector('#schedule-agent-frame')

    function reply(ok, data, error) {
      frame.contentWindow.postMessage({ type: 'BRIDGE_RESULT', id: msg.id, ok: ok, data: data, error: error }, origin)
    }

    if (msg.type === 'PING') {
      reply(true, { pong: true, href: location.href })
      return
    }

    if (msg.type === 'GET_LESSONS') {
      var params = new URLSearchParams()
      params.set('curTime', String(Date.now()))
      var week = (msg.payload && msg.payload.week) || currentWeek()
      if (week) params.set('week', String(week))
      try {
        var raw = sessionStorage.getItem('last_selected_curriculum')
        if (raw) {
          var info = JSON.parse(raw)
          if (info.schoolYear) params.set('schoolYear', info.schoolYear)
          if (info.semester) params.set('semester', String(info.semester))
          if (info.userSelectedTime) params.set('userSelectedTime', String(info.userSelectedTime))
        }
      } catch (err) {}
      fetch('/pc/curriculum/getMyLessons?' + params.toString(), { credentials: 'include' })
        .then(function (res) { return res.json() })
        .then(function (json) {
          if (!json || json.result != 1) {
            reply(false, null, (json && json.msg) || '读取课表失败，请先登录学习通')
            return
          }
          reply(true, json.data || {})
        })
        .catch(function (err) { reply(false, null, err.message) })
      return
    }

    if (msg.type === 'ADD_LESSON') {
      var course = (msg.payload && msg.payload.course) || {}
      var curriculumUuid = msg.payload && msg.payload.curriculumUuid
      var periods = (course.periods || []).slice().sort(function (a, b) { return a - b })
      var body = formBody({
        name: course.name,
        teacherName: course.teacher,
        dayOfWeek: course.weekday,
        beginNumber: periods[0] || 1,
        length: periods.length || 1,
        location: course.location || '',
        weeks: weeksFromRange(course.weekStart || 1, course.weekEnd || 16),
        weekType: 2,
        curriculumUuid: curriculumUuid,
        role: 1,
        lessonConfigUuid: uuid(),
        lessonId: course.lessonId || '',
        selectWeek: currentWeek(),
        fid: (window.Schedule && Schedule.curriculum && Schedule.curriculum.fid) || 0
      })
      fetch('/pc/curriculum/addOrUpdateLesson', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      })
        .then(function (res) { return res.json() })
        .then(function (json) {
          if (!json || json.result != 1) {
            reply(false, null, (json && json.msg) || '写入学习通课表失败')
            return
          }
          reloadSchedule()
          reply(true, json)
        })
        .catch(function (err) { reply(false, null, err.message) })
    }
  })
})()
