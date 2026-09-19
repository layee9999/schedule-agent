// ==UserScript==
// @name         课表服务智能体
// @namespace    schedule-agent
// @version      1.8.1
// @description  在超星学习通教师课表页挂载智能体，解析课程并写入真实课表
// @match        *://kb.chaoxing.com/*
// @match        *://kb.chaoxing.com/res/pc/curriculum/schedule.html*
// @include      *://kb.chaoxing.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// @connect      192.168.31.11
// @run-at       document-start
// @inject-into  content
// @downloadURL  http://127.0.0.1:5173/chaoxing-schedule-agent.user.js
// @updateURL    http://127.0.0.1:5173/chaoxing-schedule-agent.user.js
// ==/UserScript==

(function () {
  console.log('[课表智能体] 1.8.1 已执行', location.href, 'name=', window.name, 'ready=', document.readyState)

  var HIDDEN_FRAMES = { insertSign: 1, insertCloud: 1, insertMeet: 1, insertNote: 1, insertKnowledge: 1 }

  function showCrash(err, mountDoc) {
    try {
      console.error('[课表智能体] 启动失败', err)
      var d = mountDoc || document
      if (d.getElementById('schedule-agent-crash')) return
      var box = d.createElement('div')
      box.id = 'schedule-agent-crash'
      box.textContent = '课表智能体启动失败：' + (err && err.message ? err.message : err)
      box.style.cssText =
        'all:initial;position:fixed;top:72px;right:16px;z-index:2147483647;background:#c62828;color:#fff;padding:10px 12px;border-radius:8px;font:12px/1.4 sans-serif;max-width:280px;display:block;'
      ;(d.documentElement || d.body).appendChild(box)
    } catch (ignore) {}
  }

  function frameSize(w) {
    try {
      return { w: w.innerWidth || 0, h: w.innerHeight || 0 }
    } catch (err) {
      return { w: 0, h: 0 }
    }
  }

  function isVisibleWindow(w) {
    var size = frameSize(w)
    return size.w >= 200 && size.h >= 160
  }

  try {
    var pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    var win = pageWin
    var promoted = false
    var isTop = false
    try {
      isTop = pageWin.top === pageWin
    } catch (err) {
      isTop = false
    }

    // 顶层课表页（例如 schedule.html?role=1）一律挂载，不要用尺寸判断误跳过。
    // 只有明确的隐藏 iframe 才尝试提升到 top，提升失败则退出。
    if (!isTop && HIDDEN_FRAMES[window.name]) {
      try {
        if (pageWin.top && pageWin.top.document) {
          win = pageWin.top
          promoted = true
        }
      } catch (err) {
        console.log('[课表智能体] 跳过隐藏 iframe', window.name, location.href)
        return
      }
    } else if (!isTop && !isVisibleWindow(pageWin)) {
      console.log('[课表智能体] 跳过过小 iframe', window.name || location.href, frameSize(pageWin))
      return
    }

    var doc = win.document || document
    var existing = doc.getElementById('schedule-agent-root')
    if (existing) {
      var existFab = existing.querySelector('#cxsa-fab')
      var rect = existFab && existFab.getBoundingClientRect()
      if (rect && rect.width >= 20 && rect.height >= 20) {
        console.log('[课表智能体] 可见浮层已存在，跳过', window.name || location.href)
        return
      }
      try {
        existing.parentNode.removeChild(existing)
      } catch (ignore) {}
    }

    var ORIGIN = localStorage.getItem('schedule-agent-origin') || 'http://127.0.0.1:5173'
    var state = {
      view: 'landing',
      messages: [],
      pending: [],
      saved: [],
      lessons: [],
      courses: [],
      curriculum: null,
      busy: false,
      editing: false,
      occupancy: null,
      confirmError: '',
      slots: {},
    }

    function uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
    }

    function robotSvg(size) {
      return (
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true">' +
        '<circle cx="32" cy="32" r="32" fill="#E8F1FF"></circle>' +
        '<rect x="14" y="18" width="36" height="30" rx="14" fill="#4C8DFF"></rect>' +
        '<circle cx="24.5" cy="32" r="4.2" fill="#fff"></circle>' +
        '<circle cx="39.5" cy="32" r="4.2" fill="#fff"></circle>' +
        '<circle cx="25.2" cy="32.5" r="1.6" fill="#2B4C8A"></circle>' +
        '<circle cx="40.2" cy="32.5" r="1.6" fill="#2B4C8A"></circle>' +
        '<rect x="26" y="40" width="12" height="3.2" rx="1.6" fill="#D6E6FF"></rect>' +
        '<rect x="30" y="10" width="4" height="8" rx="2" fill="#4C8DFF"></rect>' +
        '<circle cx="32" cy="9" r="3" fill="#7EB3FF"></circle>' +
        '</svg>'
      )
    }

    function bookIcon() {
      return '<span style="width:22px;height:22px;border-radius:6px;background:#e8f1ff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 5.5h9.5A2.5 2.5 0 0 1 18 8v11H8.5A2.5 2.5 0 0 0 6 21.5V5.5Z" stroke="#3D7BFF" stroke-width="1.7"/><path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H18" stroke="#3D7BFF" stroke-width="1.7"/></svg></span>'
    }

    function weekdayLabel(day) {
      return ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][day] || '周' + day
    }

    function rangeToWeeks(start, end) {
      var list = []
      for (var i = start; i <= end; i += 1) list.push(String(i))
      return list.join(',')
    }

    function weeksToRange(weeks) {
      var set = parseWeekSet(weeks)
      var nums = Object.keys(set).map(Number).filter(function (item) { return item > 0 })
      if (!nums.length) return { weekStart: 1, weekEnd: 16 }
      return { weekStart: Math.min.apply(null, nums), weekEnd: Math.max.apply(null, nums) }
    }

    function parseWeekSet(weeks, weekStart, weekEnd) {
      var set = {}
      String(weeks || '')
        .split(/[,，]/)
        .forEach(function (part) {
          var text = String(part || '').trim()
          if (!text) return
          var range = text.match(/(\d+)\s*[-–~至到]\s*(\d+)/)
          if (range) {
            var from = Number(range[1])
            var to = Number(range[2])
            if (from > to) { var swap = from; from = to; to = swap }
            for (var i = from; i <= to; i += 1) set[i] = true
            return
          }
          var num = Number(text.replace(/[^\d]/g, ''))
          if (num > 0) set[num] = true
        })
      if (!Object.keys(set).length) {
        var start = Number(weekStart || 0)
        var end = Number(weekEnd || 0)
        if (start > 0 && end >= start) {
          for (var week = start; week <= end; week += 1) set[week] = true
        }
      }
      return set
    }

    function courseWeekSet(course) {
      if (course && course.weekSet && Object.keys(course.weekSet).length) return course.weekSet
      return parseWeekSet(course && course.weeks, course && course.weekStart, course && course.weekEnd)
    }

    function toMinutes(text) {
      var parts = String(text || '').split(':')
      return Number(parts[0] || 0) * 60 + Number(parts[1] || 0)
    }

    function curriculum() {
      return (win.Schedule && win.Schedule.curriculum) || state.curriculum || {}
    }

    function lessonTimeConfig() {
      var cur = curriculum()
      return (win.Schedule && win.Schedule.stime) || cur.lessonTimeConfigArray || []
    }

    function slotFromConfig(index) {
      var raw = String(lessonTimeConfig()[index] || '')
      var parts = raw.split('-')
      return { start: parts[0] || '', end: parts[1] || parts[0] || '' }
    }

    function mapCourseToSlot(course) {
      var periods = (course.periods || [])
        .map(function (n) { return Number(n) })
        .filter(function (n) { return n >= 1 && n <= 12 })
        .sort(function (a, b) { return a - b })
      if (!periods.length) periods = [1]
      var begin = periods[0]
      var length = periods.length
      var table = [
        ['08:00', '08:50'], ['08:55', '09:45'], ['10:00', '10:50'], ['11:00', '11:50'],
        ['14:00', '14:50'], ['15:00', '15:50'], ['16:00', '16:50'], ['17:00', '17:50'],
        ['19:00', '19:50'], ['20:00', '20:50'],
      ]
      var startTime = course.startTime || (table[begin - 1] && table[begin - 1][0]) || ''
      var endTime = course.endTime || (table[begin + length - 2] && table[begin + length - 2][1]) || ''
      return { begin: begin, length: length, periods: periods, startTime: startTime, endTime: endTime }
    }

    function pickNumber(lesson, keys) {
      for (var i = 0; i < keys.length; i += 1) {
        if (lesson[keys[i]] == null || lesson[keys[i]] === '') continue
        var num = Number(lesson[keys[i]])
        if (isFinite(num)) return num
      }
      return NaN
    }

    function lessonDay(lesson) {
      return pickNumber(lesson, ['dayOfWeek', 'weekday', 'xqj', 'weekDay', 'day'])
    }

    function lessonBegin(lesson) {
      return pickNumber(lesson, ['beginNumber', 'begin', 'ksjc', 'skjc', 'startSection', 'sectionStart'])
    }

    function lessonLength(lesson) {
      var len = pickNumber(lesson, ['length', 'len', 'jsjc', 'sectionLength'])
      if (isFinite(len) && len > 0) return len
      var end = pickNumber(lesson, ['endNumber', 'jsjc'])
      var begin = lessonBegin(lesson)
      if (isFinite(end) && isFinite(begin) && end >= begin) return end - begin + 1
      return 1
    }

    function lessonToCourse(lesson, index) {
      var begin = lessonBegin(lesson)
      if (!isFinite(begin)) begin = 1
      var length = lessonLength(lesson)
      var periods = []
      for (var i = 0; i < length; i += 1) periods.push(begin + i)
      var range = weeksToRange(lesson.weeks)
      return {
        id: String(lesson.lessonId || lesson.lessonConfigUuid || index),
        lessonId: lesson.lessonId || '',
        name: lesson.name || '未命名课程',
        teacher: lesson.teacherName || '',
        weekday: lessonDay(lesson) || 1,
        periods: periods,
        beginNumber: begin,
        length: length,
        location: lesson.location || '',
        weeks: lesson.weeks || '',
        weekSet: parseWeekSet(lesson.weeks, range.weekStart, range.weekEnd),
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
      }
    }

    function gmParse(payload) {
      return new Promise(function (resolve, reject) {
        var gmx = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest)
        if (!gmx) {
          fetch(ORIGIN + '/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then(function (res) {
              return res.json().then(function (data) {
                if (!res.ok) throw new Error(data.error || '解析失败')
                resolve(data)
              })
            })
            .catch(reject)
          return
        }
        gmx({
          method: 'POST',
          url: ORIGIN + '/api/parse',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(payload),
          onload: function (res) {
            try {
              var data = JSON.parse(res.responseText || '{}')
              if (res.status >= 400) reject(new Error(data.error || '解析失败'))
              else resolve(data)
            } catch (parseErr) {
              reject(parseErr)
            }
          },
          onerror: function () {
            reject(new Error('连不上本地智能体 ' + ORIGIN + '，请先运行 npm run dev'))
          },
        })
      })
    }

    function pageFetch(url, options) {
      return win.fetch(url, Object.assign({ credentials: 'include' }, options || {}))
    }

    function currentWeek() {
      var weekEl = doc.querySelector('.selectBox .week')
      return (
        (weekEl && weekEl.getAttribute('week')) ||
        (state.curriculum && state.curriculum.currentWeek) ||
        (win.Schedule && win.Schedule.curriculum && win.Schedule.curriculum.currentWeek) ||
        ''
      )
    }

    function flattenLessons(list) {
      var out = []
      ;(list || []).forEach(function (lesson) {
        if (!lesson) return
        out.push(lesson)
        if (lesson.conflictLessons && lesson.conflictLessons.length) {
          lesson.conflictLessons.forEach(function (item) {
            if (item) out.push(item)
          })
        }
      })
      return out
    }

    function lessonKey(lesson) {
      return String(
        lesson.lessonConfigUuid ||
        lesson.lessonId ||
        [lesson.name, lesson.dayOfWeek, lesson.beginNumber, lesson.length, lesson.weeks].join('-'),
      )
    }

    function applyLessonMap(map) {
      var lessons = []
      Object.keys(map).forEach(function (key) {
        lessons.push(map[key])
      })
      state.lessons = lessons
      state.courses = lessons.map(lessonToCourse)
    }

    function fetchWeekData(week) {
      var params = new URLSearchParams()
      params.set('curTime', String(Date.now()))
      if (week) params.set('week', String(week))
      var cur = curriculum()
      try {
        var raw = win.sessionStorage.getItem('last_selected_curriculum')
        if (raw) {
          var info = JSON.parse(raw)
          if (info.schoolYear) params.set('schoolYear', info.schoolYear)
          if (info.semester) params.set('semester', String(info.semester))
          if (info.userSelectedTime) params.set('userSelectedTime', String(info.userSelectedTime))
        }
      } catch (ignore) {}
      if (!params.get('schoolYear') && cur.schoolYear) params.set('schoolYear', String(cur.schoolYear))
      if (!params.get('semester') && cur.semester != null && cur.semester !== '') params.set('semester', String(cur.semester))
      if (win.Schedule && win.Schedule.curFid) {
        if (win.Schedule.curFid.fidEnc) params.set('kd_fidenc', win.Schedule.curFid.fidEnc)
        if (win.Schedule.curFid.currentCampusId) params.set('currentCampusId', String(win.Schedule.curFid.currentCampusId))
      }
      return pageFetch('/pc/curriculum/getMyLessons?' + params.toString())
        .then(function (res) { return res.json() })
        .then(function (json) {
          if (!json || json.result != 1) throw new Error((json && json.msg) || '读取课表失败，请先登录学习通')
          return json.data || {}
        })
    }

    function slotKey(week, day, period) {
      return String(week) + '-' + String(day) + '-' + String(period)
    }

    function markLessonSlots(lesson, fetchedWeek) {
      var day = lessonDay(lesson)
      var begin = lessonBegin(lesson)
      if (!isFinite(day) || !isFinite(begin)) return
      var length = lessonLength(lesson)
      var weeks = parseWeekSet(lesson.weeks)
      if (fetchedWeek) weeks[Number(fetchedWeek)] = true
      if (!Object.keys(weeks).length) {
        var fallback = Number(fetchedWeek || currentWeek() || 0)
        if (fallback > 0) weeks[fallback] = true
      }
      Object.keys(weeks).forEach(function (week) {
        for (var period = begin; period < begin + length; period += 1) {
          state.slots[slotKey(week, day, period)] = {
            name: lesson.name || '未命名课程',
            day: day,
            period: period,
            week: Number(week),
            begin: begin,
            length: length,
            weeks: lesson.weeks || '',
          }
        }
      })
    }

    function collectPageLessons() {
      var extra = []
      var map = win.Schedule && win.Schedule.dailyLessonMap
      if (map && typeof map.forEach === 'function') {
        map.forEach(function (value) {
          if (value) extra.push(value)
        })
      }
      var early = Number((curriculum().earlyMorningSection) || 0)
      var nodes = doc.querySelectorAll('#scheduleTable td[lessonid], #scheduleTable td[uuid], .schedule td[lessonid], .schedule td[uuid]')
      Array.prototype.forEach.call(nodes, function (td) {
        var rowMatch = td.parentNode && String(td.parentNode.className || '').match(/row(\d+)/)
        var colMatch = String(td.className || '').match(/col(\d+)/)
        if (!rowMatch || !colMatch) return
        var nameEl = td.querySelector('.courseName, .words1, .words2, .words3')
        extra.push({
          name: (nameEl && nameEl.textContent || td.textContent || '已有课程').replace(/\s+/g, ' ').trim(),
          dayOfWeek: Number(colMatch[1]),
          beginNumber: Number(rowMatch[1]) - early,
          length: Math.max(1, Number(td.getAttribute('rowspan')) || 1),
          weeks: String(currentWeek() || ''),
          lessonId: td.getAttribute('lessonid') || td.getAttribute('lessonId') || '',
          lessonConfigUuid: td.getAttribute('uuid') || '',
        })
      })
      return extra
    }

    function pendingSlotKeys(course) {
      var slot = mapCourseToSlot(course)
      var day = Number(course.weekday || course.dayOfWeek)
      var weeks = courseWeekSet(course)
      var keys = []
      Object.keys(weeks).forEach(function (week) {
        slot.periods.forEach(function (period) {
          keys.push(slotKey(week, day, period))
        })
      })
      return keys
    }

    function getLessons(week) {
      var w = week === false ? '' : (week || currentWeek())
      return fetchWeekData(w).then(function (data) {
        if (data.curriculum) state.curriculum = data.curriculum
        var map = {}
        flattenLessons(data.lessonArray).forEach(function (lesson) {
          map[lessonKey(lesson)] = lesson
        })
        applyLessonMap(map)
        return data
      })
    }

    function pendingWeekRange() {
      var maxWeek = Number(curriculum().maxWeek || 16)
      var start = 1
      var end = maxWeek
      if (state.pending.length) {
        start = Math.min.apply(null, state.pending.map(function (course) { return Number(course.weekStart || 1) }))
        end = Math.max.apply(null, state.pending.map(function (course) { return Number(course.weekEnd || maxWeek) }))
      }
      return { weekStart: start, weekEnd: end }
    }

    function refreshOccupancy(weekStart, weekEnd, force) {
      var maxWeek = Number(curriculum().maxWeek || 20)
      var from = Math.max(1, Number(weekStart) || 1)
      var to = Math.min(maxWeek || 20, Number(weekEnd) || maxWeek || 16)
      if (to < from) to = from
      var cache = state.occupancy || {}
      if (!force && cache.from <= from && cache.to >= to && Date.now() - cache.at < 20000 && Object.keys(state.slots || {}).length) {
        return Promise.resolve(state.courses)
      }
      var weeks = []
      for (var week = from; week <= to; week += 1) weeks.push(week)
      setStatus('正在对照学习通第' + from + '-' + to + '周课表检测冲突…')
      var chain = Promise.resolve([])
      weeks.forEach(function (week) {
        chain = chain.then(function (results) {
          return fetchWeekData(week).then(function (data) {
            data._fetchedWeek = week
            results.push(data)
            return results
          }).catch(function (err) {
            console.warn('[课表智能体] 第' + week + '周课表读取失败', err)
            results.push({ lessonArray: [], _fetchedWeek: week })
            return results
          })
        })
      })
      return chain.then(function (results) {
        var map = {}
        state.slots = {}
        var weekFingerprints = []
        results.forEach(function (data) {
          if (data && data.curriculum) state.curriculum = data.curriculum
          var lessons = flattenLessons(data && data.lessonArray)
          var fingerprint = lessons
            .map(function (lesson) {
              return [lesson.name, lessonDay(lesson), lessonBegin(lesson), lessonLength(lesson)].join(':')
            })
            .sort()
            .join('|')
          weekFingerprints.push({
            week: data._fetchedWeek,
            n: lessons.length,
            sameAsPrev: weekFingerprints.length ? fingerprint === weekFingerprints[weekFingerprints.length - 1].fp : false,
            fp: fingerprint,
          })
          lessons.forEach(function (lesson) {
            map[lessonKey(lesson)] = lesson
            markLessonSlots(lesson, data._fetchedWeek)
          })
        })
        collectPageLessons().forEach(function (lesson) {
          map[lessonKey(lesson)] = map[lessonKey(lesson)] || lesson
          markLessonSlots(lesson, currentWeek())
        })
        applyLessonMap(map)
        state.occupancy = { from: from, to: to, at: Date.now() }
        setStatus('')
        var uniqueWeeks = {}
        weekFingerprints.forEach(function (item) { uniqueWeeks[item.fp] = (uniqueWeeks[item.fp] || 0) + 1 })
        var sampleLesson = state.lessons[0]
        console.log('[课表智能体] 占课已同步', {
          from: from,
          to: to,
          uniqueLessons: state.courses.length,
          slotCount: Object.keys(state.slots).length,
          weekParamWorks: Object.keys(uniqueWeeks).length > 1,
          weekCounts: weekFingerprints.map(function (item) { return item.week + ':' + item.n }),
          rawKeys: sampleLesson ? Object.keys(sampleLesson) : [],
          rawSample: state.lessons.slice(0, 11).map(function (lesson) {
            return {
              name: lesson.name,
              dayOfWeek: lesson.dayOfWeek,
              beginNumber: lesson.beginNumber,
              length: lesson.length,
              weeks: lesson.weeks,
              mappedDay: lessonDay(lesson),
              mappedBegin: lessonBegin(lesson),
              mappedLen: lessonLength(lesson),
            }
          }),
        })
        return state.courses
      })
    }

    function curriculumUuid() {
      return (
        (state.curriculum && state.curriculum.uuid) ||
        (win.Schedule && win.Schedule.curriculum && win.Schedule.curriculum.uuid) ||
        ''
      )
    }

    function addLesson(course) {
      var slot = mapCourseToSlot(course)
      var name = String(course.name || '').trim()
      if (!name) return Promise.reject(new Error('课程名称为空，无法写入'))
      var maxWeek = Number(curriculum().maxWeek || 16)
      var weekStart = Number(course.weekStart || 1)
      var weekEnd = Number(course.weekEnd || maxWeek)
      var weeks = rangeToWeeks(weekStart, weekEnd)
      var weekType = '2'
      var body = new URLSearchParams({
        name: name,
        teacherName: course.teacher || '',
        dayOfWeek: String(course.weekday || 1),
        beginNumber: String(slot.begin),
        length: String(slot.length),
        location: course.location || '',
        weeks: weeks,
        weekType: weekType,
        curriculumUuid: curriculumUuid(),
        role: '1',
        lessonConfigUuid: uuid(),
        lessonId: '',
        selectWeek: String(currentWeek()),
        fid: String(curriculum().fid || 0),
        courseId: '',
        personId: '',
        classId: '',
        className: '',
        onlineLocation: '',
        teachPlanId: '',
        teachPlanName: '',
      })
      console.log('[课表智能体] 写入节次', {
        name: name,
        parsedPeriods: course.periods,
        clock: (course.startTime || '') + '-' + (course.endTime || ''),
        mapped: slot,
        weeks: weeks,
        weekType: weekType,
        pendingKeys: pendingSlotKeys(course),
        hits: pendingSlotKeys(course).map(function (key) {
          return { key: key, hit: state.slots[key] || null }
        }),
      })
      return pageFetch('/pc/curriculum/addOrUpdateLesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
        .then(function (res) { return res.json() })
        .then(function (json) {
          if (!json || json.result != 1) throw new Error((json && json.msg) || '写入学习通课表失败')
          return json
        })
    }

    function reloadSchedule() {
      try {
        win.localStorage.setItem('op', '1')
        var week = currentWeek()
        if (win.Schedule && typeof win.Schedule.loadLessons === 'function') {
          win.Schedule.loadLessons(week)
          return
        }
      } catch (ignore) {}
      try {
        win.location.reload()
      } catch (ignore) {}
    }

    function occupiedPeriods(course) {
      var periods = (course.periods || [])
        .map(function (item) { return Number(item) })
        .filter(function (item) { return isFinite(item) })
      if (periods.length) return periods
      var begin = Number(course.beginNumber)
      if (!isFinite(begin)) begin = 1
      var length = Math.max(1, Number(course.length) || 1)
      var list = []
      for (var i = 0; i < length; i += 1) list.push(begin + i)
      return list
    }

    function weeksOverlap(a, b) {
      var left = courseWeekSet(a)
      var right = courseWeekSet(b)
      for (var key in left) {
        if (left[key] && right[key]) return true
      }
      return false
    }

    function overlaps(a, b) {
      if (Number(a.weekday || a.dayOfWeek) !== Number(b.weekday || b.dayOfWeek)) return false
      if (!weeksOverlap(a, b)) return false
      var other = occupiedPeriods(b)
      return occupiedPeriods(a).some(function (period) { return other.indexOf(period) >= 0 })
    }

    function conflictLines(incoming) {
      var lines = []
      var seen = {}
      ;(incoming || []).forEach(function (course) {
        pendingSlotKeys(course).forEach(function (key) {
          var hit = state.slots[key]
          if (!hit) return
          var parts = key.split('-')
          var line =
            '第' + (course.weekStart || 1) + '-' + (course.weekEnd || 16) + '周，' +
            weekdayLabel(Number(parts[1])) + '，第' + parts[2] +
            '节已有课程「' + hit.name + '」'
          if (!seen[line]) {
            seen[line] = true
            lines.push(line)
          }
        })
        if (Object.keys(state.slots || {}).length) return
        state.courses.forEach(function (exist) {
          if (!overlaps(course, exist)) return
          var hits = occupiedPeriods(course).filter(function (period) {
            return occupiedPeriods(exist).indexOf(period) >= 0
          })
          var line =
            '第' + (course.weekStart || 1) + '-' + (course.weekEnd || 16) + '周，' +
            weekdayLabel(course.weekday) + '，第' + (hits.join('、') || occupiedPeriods(course).join('、')) +
            '节已有课程「' + exist.name + '」'
          if (!seen[line]) {
            seen[line] = true
            lines.push(line)
          }
        })
      })
      return lines
    }

    function q(id) {
      return host.querySelector('#' + id)
    }

    function escapeHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function courseLine(course) {
      var slot = mapCourseToSlot(course)
      var time = (slot.startTime && slot.endTime) ? slot.startTime + '-' + slot.endTime : ''
      var periodText = slot.periods.length > 1
        ? '第' + slot.periods[0] + '-' + slot.periods[slot.periods.length - 1] + '节'
        : '第' + (slot.periods[0] || slot.begin) + '节'
      return {
        name: course.name || '未命名',
        teacher: course.teacher || '教师待定',
        time: weekdayLabel(course.weekday) + (time ? ' ' + time : '') + '（' + periodText + '）',
        location: course.location || '地点待定',
        weeks: '第' + (course.weekStart || 1) + '-' + (course.weekEnd || 16) + '周',
      }
    }

    var host = doc.createElement('div')
    host.id = 'schedule-agent-root'
    host.setAttribute('data-schedule-agent', '1.8.1')
    host.style.cssText = [
      'all:initial',
      'box-sizing:border-box',
      'position:fixed',
      'top:56px',
      'right:16px',
      'left:auto',
      'bottom:auto',
      'z-index:2147483647',
      'width:auto',
      'height:auto',
      'display:flex',
      'flex-direction:column',
      'align-items:flex-end',
      'gap:10px',
      'margin:0',
      'padding:0',
      'overflow:visible',
      'opacity:1',
      'visibility:visible',
      'transform:none',
      'filter:none',
      'background:transparent',
      'pointer-events:none',
      'font-family:"PingFang SC","Microsoft YaHei",sans-serif',
    ].join(' !important;') + ' !important;'

    var fab = doc.createElement('button')
    fab.id = 'cxsa-fab'
    fab.type = 'button'
    fab.innerHTML = robotSvg(54)
    fab.style.cssText = [
      'all:unset',
      'box-sizing:border-box',
      'display:grid',
      'place-items:center',
      'width:58px',
      'height:58px',
      'border:0',
      'border-radius:50%',
      'background:transparent',
      'cursor:pointer',
      'box-shadow:0 8px 24px rgba(61,123,255,.28)',
      'opacity:1',
      'visibility:visible',
      'pointer-events:auto',
      'margin:0',
      'padding:0',
      'overflow:hidden',
    ].join(' !important;') + ' !important;'

    var panel = doc.createElement('div')
    panel.id = 'cxsa-panel'
    panel.style.cssText =
      'all:initial;box-sizing:border-box;display:none;flex-direction:column;width:390px;height:min(740px,calc(100vh - 80px));background:#f6f8fc;border-radius:28px;box-shadow:0 18px 50px rgba(20,40,80,.28);overflow:hidden;font:14px/1.5 "PingFang SC","Microsoft YaHei",sans-serif;color:#1d2433;pointer-events:auto;'

    host.appendChild(panel)
    host.appendChild(fab)

    function attachHost() {
      var target = doc.documentElement || doc.body
      if (!target) return false
      if (host.parentNode !== target || target.lastChild !== host) {
        target.appendChild(host)
      }
      return true
    }

    if (!attachHost()) {
      doc.addEventListener('DOMContentLoaded', attachHost)
    }

    try {
      panel.innerHTML =
        '<div id="cxsa-hd" style="height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 12px;background:#fff;box-sizing:border-box;">' +
        '  <div style="display:flex;align-items:center;gap:8px;">' +
        robotSvg(28) +
        '    <span id="cxsa-title" style="font-weight:700;font-size:16px;">AI 课程助手</span>' +
        '  </div>' +
        '  <button id="cxsa-close" type="button" style="all:unset;cursor:pointer;font-size:22px;padding:8px 12px;color:#333;">×</button>' +
        '</div>' +
        '<div id="cxsa-status" style="display:none;padding:6px 14px;font-size:12px;color:#3d7bff;background:#eaf2ff;"></div>' +
        '<div id="cxsa-main" style="flex:1;overflow:auto;display:flex;flex-direction:column;background:#f7f9fc;min-height:0;"></div>' +
        '<div id="cxsa-composer" style="display:flex;gap:8px;padding:10px 12px 14px;background:#f7f9fc;box-sizing:border-box;align-items:center;">' +
        '  <input id="cxsa-input" placeholder="请输入课程安排，例如：周三下午2点上高数..." style="flex:1;border:0;background:#fff;border-radius:22px;padding:12px 16px;font:14px/1.4 sans-serif;box-shadow:0 2px 10px rgba(40,70,140,.06);outline:none;">' +
        '  <button id="cxsa-import" type="button" title="导入课表图片" style="all:unset;cursor:pointer;width:36px;height:36px;border-radius:18px;background:#fff;color:#8b93a7;text-align:center;box-shadow:0 2px 10px rgba(40,70,140,.06);">＋</button>' +
        '</div>' +
        '<input id="cxsa-file" type="file" accept="image/*" hidden>'
    } catch (htmlErr) {
      console.error('[课表智能体] 面板 HTML 写入失败', htmlErr)
    }

    setTimeout(attachHost, 400)
    setTimeout(attachHost, 1600)
    if (typeof MutationObserver === 'function' && doc.documentElement) {
      var mo = new MutationObserver(function () {
        attachHost()
      })
      mo.observe(doc.documentElement, { childList: true })
    }

    console.log(
      '[课表智能体] 已挂到可见页面',
      win.location.href,
      'from',
      window.name || 'top',
      'promoted=' + promoted,
      'size=',
      frameSize(win),
    )

    function setPanelOpen(open) {
      panel.style.display = open ? 'flex' : 'none'
      if (open) host.classList.add('cxsa-open')
      else host.classList.remove('cxsa-open')
    }

    function setStatus(text) {
      var el = q('cxsa-status')
      if (!el) return
      if (!text) {
        el.style.display = 'none'
        return
      }
      el.style.display = 'block'
      el.textContent = text
    }

    function courseCardHtml(course, compact) {
      var info = courseLine(course)
      if (compact) {
        return (
          '<article style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 8px 20px rgba(40,70,140,.06);margin-top:8px;text-align:left;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700;">' + bookIcon() + escapeHtml(info.name) + '</div>' +
          '<p style="margin:0;color:#8b93a7;font-size:13px;">' +
          escapeHtml(weekdayLabel(course.weekday) + ' ' + info.time.replace(weekdayLabel(course.weekday) + ' ', '') + '  ' + info.teacher + '  ' + info.location + '  ' + (course.weekStart || 1) + '-' + (course.weekEnd || 16) + '周') +
          '</p></article>'
        )
      }
      return (
        '<article style="background:#fff;border-radius:16px;padding:14px;box-shadow:0 8px 20px rgba(40,70,140,.06);margin-top:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:700;">' + bookIcon() + escapeHtml(info.name) + '</div>' +
        '<div style="display:grid;gap:6px;font-size:13px;">' +
        '<div style="display:grid;grid-template-columns:42px 1fr;"><span style="color:#8b93a7;">教师</span><span>' + escapeHtml(info.teacher) + '</span></div>' +
        '<div style="display:grid;grid-template-columns:42px 1fr;"><span style="color:#8b93a7;">时间</span><span>' + escapeHtml(info.time) + '</span></div>' +
        '<div style="display:grid;grid-template-columns:42px 1fr;"><span style="color:#8b93a7;">地点</span><span>' + escapeHtml(info.location) + '</span></div>' +
        '<div style="display:grid;grid-template-columns:42px 1fr;"><span style="color:#8b93a7;">周次</span><span>' + escapeHtml(info.weeks) + '</span></div>' +
        '</div></article>'
      )
    }

    function editFormHtml(course) {
      return (
        '<div style="background:#fff;border-radius:16px;padding:12px;display:grid;gap:8px;margin-top:8px;">' +
        '<label style="display:grid;gap:4px;font-size:12px;color:#8b93a7;">节次（如 3-4）<input id="cxsa-edit-periods" value="' + escapeHtml((course.periods || []).join('-')) + '" style="border:1px solid #e8edf5;border-radius:10px;padding:8px 10px;color:#1d2433;"></label>' +
        '<label style="display:grid;gap:4px;font-size:12px;color:#8b93a7;">地点<input id="cxsa-edit-loc" value="' + escapeHtml(course.location || '') + '" style="border:1px solid #e8edf5;border-radius:10px;padding:8px 10px;color:#1d2433;"></label>' +
        '</div>'
      )
    }

    function bindMain() {
      var add = q('cxsa-act-add')
      var imp = q('cxsa-act-import')
      var edit = q('cxsa-act-edit')
      var conflict = q('cxsa-act-conflict')
      if (add) add.onclick = function () { openChat('请输入课程安排，例如：周三下午两点上高等数学，张老师，A101，上16周') }
      if (imp) imp.onclick = function () { q('cxsa-file').click() }
      if (edit) edit.onclick = function () { openChat('请告诉我要改哪一门课，例如：把设计课的教室改到 B305') }
      if (conflict) conflict.onclick = function () {
        void (async function () {
          state.view = 'chat'
          state.busy = true
          render()
          try {
            await refreshOccupancy(1, Number(curriculum().maxWeek || 16), true)
            var pairs = []
            for (var i = 0; i < state.courses.length; i += 1) {
              for (var j = i + 1; j < state.courses.length; j += 1) {
                if (overlaps(state.courses[i], state.courses[j])) {
                  pairs.push(state.courses[i].name + ' 与 ' + state.courses[j].name + ' 在' + weekdayLabel(state.courses[i].weekday) + '节次重叠')
                }
              }
            }
            state.messages = [{
              id: uuid(),
              role: 'assistant',
              text: pairs.length ? '检测到冲突：\n' + pairs.join('\n') : '当前课表未检测到时间冲突，可以正常添加。',
            }]
          } catch (conflictErr) {
            state.messages = [{ id: uuid(), role: 'assistant', text: conflictErr.message || '检查冲突失败' }]
          } finally {
            state.busy = false
            render()
          }
        })()
      }
      if (q('cxsa-go-confirm')) q('cxsa-go-confirm').onclick = function () { void goToConfirm() }
      if (q('cxsa-edit-toggle')) q('cxsa-edit-toggle').onclick = function () {
        state.editing = !state.editing
        render()
      }
      if (q('cxsa-edit-periods') && state.pending[0]) {
        q('cxsa-edit-periods').oninput = function (event) {
          var periods = String(event.target.value).split(/[-,，\s]+/).map(Number).filter(function (n) { return n >= 1 && n <= 10 })
          if (periods.length) state.pending[0].periods = periods
        }
      }
      if (q('cxsa-edit-loc') && state.pending[0]) {
        q('cxsa-edit-loc').oninput = function (event) {
          state.pending[0].location = event.target.value
        }
      }
      if (q('cxsa-confirm-write')) q('cxsa-confirm-write').onclick = function () { void confirmAdd() }
      if (q('cxsa-confirm-cancel')) q('cxsa-confirm-cancel').onclick = function () {
        state.view = 'chat'
        render()
      }
      if (q('cxsa-success-close')) q('cxsa-success-close').onclick = function () { setPanelOpen(false) }
      if (q('cxsa-success-more')) q('cxsa-success-more').onclick = function () {
        state.view = 'landing'
        state.pending = []
        state.messages = []
        render()
      }
      if (q('cxsa-import-skip')) q('cxsa-import-skip').onclick = function () {
        state.pending = []
        state.view = 'landing'
        render()
      }
      if (q('cxsa-import-all')) q('cxsa-import-all').onclick = function () { void goToConfirm() }
    }

    function openChat(hint) {
      state.view = 'chat'
      state.messages = [{ id: uuid(), role: 'assistant', text: hint }]
      render()
    }

    async function goToConfirm() {
      if (!state.pending.length) return
      state.confirmError = ''
      state.view = 'confirm'
      state.busy = true
      render()
      try {
        var range = pendingWeekRange()
        await refreshOccupancy(range.weekStart, range.weekEnd, true)
      } catch (err) {
        state.confirmError = err.message || '读取课表失败'
      } finally {
        state.busy = false
        render()
      }
    }

    function render() {
      var main = q('cxsa-main')
      var composer = q('cxsa-composer')
      var title = q('cxsa-title')
      if (!main) return
      if (title) title.textContent = state.view === 'landing' ? 'AI 课程助手' : '课程创建助手'
      if (composer) composer.style.display = (state.view === 'chat' || state.view === 'landing') ? 'flex' : 'none'

      if (state.view === 'landing') {
        main.style.background = 'linear-gradient(180deg,#eaf2ff 0%,#f6f8fc 28%)'
        main.innerHTML =
          '<div style="padding:18px 20px 8px;display:flex;gap:12px;align-items:center;">' +
          robotSvg(72) +
          '<div><h2 style="margin:0;font-size:22px;line-height:1.3;">你好！<br>我是你的课程创建助手</h2>' +
          '<p style="margin:8px 0 0;color:#8b93a7;font-size:13px;">我可以帮你快速添加课程、导入课表、修改课程或检查时间冲突。</p></div></div>' +
          '<div style="padding:8px 20px 10px;font-weight:700;">你可以这样做</div>' +
          '<div style="display:grid;gap:10px;padding:0 16px 20px;">' +
          actionCard('cxsa-act-add', '+', '添加一门课程', '通过对话或自然语言创建课程') +
          actionCard('cxsa-act-import', '▣', '导入课表', '支持图片、文件、分享') +
          actionCard('cxsa-act-edit', '✎', '修改已有课程', '快速调整课程信息') +
          actionCard('cxsa-act-conflict', '!', '检查课程冲突', '智能检测时间冲突') +
          '</div>'
        bindMain()
        return
      }

      if (state.view === 'confirm') {
        var conflicts = conflictLines(state.pending)
        if (state.confirmError && conflicts.indexOf(state.confirmError) < 0) conflicts = [state.confirmError].concat(conflicts)
        var bannerText = state.busy
          ? '正在对照学习通课表检测冲突…'
          : (conflicts.length ? conflicts.join('；') : '未检测到时间冲突，可以正常添加。')
        main.style.background = '#f7f9fc'
        main.innerHTML =
          '<div style="flex:1;overflow:auto;padding:8px 16px 88px;">' +
          '  <h2 style="font-size:20px;margin:8px 0 6px;">确认添加确认</h2>' +
          '  <p style="margin:0 0 12px;color:#8b93a7;font-size:13px;">以下是你要添加的课程信息，请确认：</p>' +
          state.pending.map(function (course) { return courseCardHtml(course) }).join('') +
          '  <div style="margin-top:12px;background:' + (conflicts.length || state.busy ? '#feeced' : '#fff6e8') + ';color:' + (conflicts.length ? '#c2410c' : '#c27800') + ';border-radius:12px;padding:10px 12px;font-size:13px;">' +
          escapeHtml(bannerText) +
          '  </div></div>' +
          '<div style="padding:0 16px 16px;display:flex;gap:10px;">' +
          '<button id="cxsa-confirm-cancel" type="button" style="flex:1;border:1px solid #d7e4ff;border-radius:22px;padding:10px 18px;font-weight:600;background:#fff;color:#3d7bff;cursor:pointer;">取消</button>' +
          '<button id="cxsa-confirm-write" type="button" style="flex:1;border:0;border-radius:22px;padding:10px 18px;font-weight:600;background:' + (conflicts.length ? '#9bb8f0' : '#3d7bff') + ';color:#fff;cursor:pointer;"' + (state.busy || conflicts.length ? ' disabled' : '') + '>确认添加</button>' +
          '</div>'
        bindMain()
        return
      }

      if (state.view === 'success') {
        var mainCourse = state.saved[0]
        main.style.background = '#f7f9fc'
        main.style.alignItems = 'center'
        main.innerHTML =
          '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;">' +
          '<div style="width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,#7eb6ff,#3d7bff);color:#fff;font-size:40px;box-shadow:0 10px 24px rgba(61,123,255,.28);">✓</div>' +
          '<h2 style="margin:0;">课程已添加成功</h2>' +
          (mainCourse ? '<div style="width:100%;">' + courseCardHtml(mainCourse, state.saved.length > 1) + '</div>' : '') +
          (state.saved.length > 1 ? '<p style="color:#8b93a7;">共添加 ' + state.saved.length + ' 门课程</p>' : '') +
          '<div style="display:flex;gap:10px;width:100%;">' +
          '<button id="cxsa-success-close" type="button" style="flex:1;border:0;border-radius:22px;padding:10px 18px;font-weight:600;background:#3d7bff;color:#fff;cursor:pointer;">查看课表</button>' +
          '<button id="cxsa-success-more" type="button" style="flex:1;border:1px solid #d7e4ff;border-radius:22px;padding:10px 18px;font-weight:600;background:#fff;color:#3d7bff;cursor:pointer;">继续添加</button>' +
          '</div></div>'
        bindMain()
        return
      }

      if (state.view === 'import') {
        main.style.background = '#f7f9fc'
        main.innerHTML =
          '<div style="flex:1;overflow:auto;padding:8px 16px 88px;">' +
          '<p style="font-weight:700;margin:8px 0 12px;">已识别到以下' + state.pending.length + '门课程，请确认是否添加：</p>' +
          state.pending.map(function (course) { return courseCardHtml(course, true) }).join('') +
          '</div>' +
          '<div style="padding:0 16px 16px;display:flex;gap:10px;">' +
          '<button id="cxsa-import-skip" type="button" style="flex:1;border:1px solid #d7e4ff;border-radius:22px;padding:10px 18px;font-weight:600;background:#fff;color:#3d7bff;cursor:pointer;">暂不添加</button>' +
          '<button id="cxsa-import-all" type="button" style="flex:1;border:0;border-radius:22px;padding:10px 18px;font-weight:600;background:#3d7bff;color:#fff;cursor:pointer;">全部添加</button>' +
          '</div>'
        bindMain()
        return
      }

      main.style.background = '#f7f9fc'
      var html = '<div style="flex:1;overflow:auto;padding:8px 14px 16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">'
      html += state.messages
        .map(function (msg) {
          if (msg.role === 'user') {
            return (
              '<div style="display:flex;justify-content:flex-end;">' +
              '<div style="max-width:82%;background:#3d7bff;color:#fff;border-radius:16px 16px 6px 16px;padding:10px 12px;white-space:pre-wrap;">' +
              escapeHtml(msg.text) +
              '</div></div>'
            )
          }
          var block =
            '<div style="display:flex;gap:8px;align-items:flex-start;">' +
            '<span style="flex-shrink:0;">' + robotSvg(28) + '</span>' +
            '<div style="flex:1;min-width:0;">' +
            (msg.text ? '<p style="margin:0 0 8px;white-space:pre-wrap;">' + escapeHtml(msg.text) + '</p>' : '')
          if (msg.courses) block += msg.courses.map(function (course) { return courseCardHtml(course) }).join('')
          block += '</div></div>'
          return block
        })
        .join('')

      if (state.pending.length && !state.busy && state.view === 'chat') {
        if (state.editing && state.pending[0]) html += editFormHtml(state.pending[0])
        html +=
          '<div style="display:grid;gap:10px;padding:4px 0 0 36px;">' +
          '<p style="margin:0;color:#1d2433;">请确认是否添加到你的课表？</p>' +
          '<div style="display:flex;gap:10px;">' +
          '<button id="cxsa-go-confirm" type="button" style="flex:1;border:0;border-radius:22px;padding:10px 18px;font-weight:600;cursor:pointer;background:#3d7bff;color:#fff;">确认添加</button>' +
          '<button id="cxsa-edit-toggle" type="button" style="flex:1;border:1px solid #d7e4ff;border-radius:22px;padding:10px 18px;font-weight:600;cursor:pointer;background:#fff;color:#3d7bff;">修改信息</button>' +
          '</div></div>'
      }
      html += '</div>'
      main.innerHTML = html
      var stream = main.firstChild
      if (stream) stream.scrollTop = stream.scrollHeight
      bindMain()
    }

    function actionCard(id, icon, title, desc) {
      return (
        '<button id="' + id + '" type="button" style="background:#fff;border:0;border-radius:16px;padding:14px 12px;display:grid;grid-template-columns:28px 1fr 12px;gap:10px;align-items:center;text-align:left;box-shadow:0 6px 16px rgba(40,70,140,.05);cursor:pointer;">' +
        '<span style="width:28px;height:28px;border-radius:14px;background:#e8f1ff;color:#3d7bff;display:grid;place-items:center;font-weight:700;">' + icon + '</span>' +
        '<div><b style="display:block;font-size:15px;">' + title + '</b><span style="color:#8b93a7;font-size:12px;">' + desc + '</span></div>' +
        '<i style="color:#c5cad6;font-style:normal;">›</i></button>'
      )
    }

    function push(role, text, extra) {
      state.messages.push(Object.assign({ id: uuid(), role: role, text: text }, extra || {}))
      render()
    }

    async function sendText(text) {
      if (!text || state.busy) return
      state.view = 'chat'
      q('cxsa-input').value = ''
      push('user', text)
      state.busy = true
      state.editing = false
      render()
      try {
        var data = await gmParse({
          mode: 'text',
          text: text,
          intent: 'add',
          existingCourses: state.courses,
        })
        state.pending = (data.courses || []).map(function (course) {
          return Object.assign({}, course, {
            weekSet: parseWeekSet(course.weeks, course.weekStart || 1, course.weekEnd || 16),
          })
        })
        var range = pendingWeekRange()
        try {
          await refreshOccupancy(range.weekStart, range.weekEnd, true)
        } catch (occupyErr) {
          console.warn('[课表智能体] 占课同步失败', occupyErr)
        }
        var reply = data.reply || '我已为你解析出以下课程信息：'
        var extra = conflictLines(state.pending)
        if (extra.length) reply += '\n注意：' + extra.join('\n')
        push('assistant', reply, { courses: state.pending })
      } catch (sendErr) {
        push('assistant', sendErr.message || '解析失败')
      } finally {
        state.busy = false
        render()
      }
    }

    async function confirmAdd() {
      if (!state.pending.length || state.busy) return
      state.busy = true
      state.confirmError = ''
      render()
      try {
        var range = pendingWeekRange()
        await refreshOccupancy(range.weekStart, range.weekEnd, true)
        if (!curriculumUuid()) throw new Error('未获取到课表 curriculumUuid，请确认已登录教师课表')
        var conflicts = conflictLines(state.pending)
        if (conflicts.length) {
          state.confirmError = conflicts.join('\n')
          throw new Error(conflicts.join('\n'))
        }
        for (var i = 0; i < state.pending.length; i += 1) {
          await addLesson(state.pending[i])
        }
        state.saved = state.pending.slice()
        state.pending = []
        state.occupancy = null
        reloadSchedule()
        await getLessons()
        state.view = 'success'
      } catch (addErr) {
        state.view = 'confirm'
        state.confirmError = addErr.message || '写入失败'
      } finally {
        state.busy = false
        render()
      }
    }

    async function syncLessons() {
      try {
        await getLessons()
        setStatus('')
      } catch (syncErr) {
        setStatus(syncErr.message)
      }
    }

    fab.onclick = function () {
      setPanelOpen(panel.style.display === 'none' || !panel.style.display)
    }
    q('cxsa-close').onclick = function () {
      setPanelOpen(false)
    }
    q('cxsa-input').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') void sendText(event.target.value.trim())
    })
    if (q('cxsa-import')) {
      q('cxsa-import').onclick = function () {
        q('cxsa-file').click()
      }
    }
    q('cxsa-file').onchange = function (event) {
      var file = event.target.files && event.target.files[0]
      event.target.value = ''
      if (!file) return
      var reader = new FileReader()
      reader.onload = function () {
        void (async function () {
          push('user', '导入课表图片：' + file.name)
          state.busy = true
          render()
          try {
            var data = await gmParse({
              mode: 'image',
              image: reader.result,
              text: '请识别这张课表图片中的全部课程',
              intent: 'import',
              existingCourses: state.courses,
            })
            state.pending = data.courses || []
            state.view = 'import'
          } catch (imgErr) {
            push('assistant', imgErr.message || '识别失败')
          } finally {
            state.busy = false
            render()
          }
        })()
      }
      reader.readAsDataURL(file)
    }

    render()
    var tries = 0
    function wait() {
      if ((win.Schedule && win.Schedule.curriculum) || tries > 40) {
        void syncLessons()
        return
      }
      tries += 1
      setTimeout(wait, 250)
    }
    wait()
  } catch (err) {
    showCrash(err)
  }
})()
