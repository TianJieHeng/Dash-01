// Temporal Bureau's wire shape is authoritative. This only creates display values.
(function (root) {
  'use strict';
  function dateParts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) throw new Error('Missing event date');
    return [+match[1], +match[2], +match[3]];
  }
  function localDate(value, extra) { var p = dateParts(value); return new Date(p[0], p[1] - 1, p[2] + (extra || 0)); }
  function wall(value, clock, zone) {
    var p = dateParts(value), t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(clock || '');
    if (!t || +t[1] > 23 || +t[2] > 59) throw new Error('Missing event time');
    var target = Date.UTC(p[0], p[1] - 1, p[2], +t[1], +t[2], +(t[3] || 0)), guess = target;
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (var i = 0; i < 4; i++) {
      var parts = {}; fmt.formatToParts(new Date(guess)).forEach(function (x) { parts[x.type] = x.value; });
      var shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
      var delta = target - shown; if (!delta) return new Date(guess); guess += delta;
    }
    throw new Error('Nonexistent wall time');
  }
  function instant(value) { var d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z'); if (!isFinite(+d)) throw new Error('Invalid instant'); return d; }
  function lane(c) {
    var color = /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#378B72';
    var rgb = [1,3,5].map(function (i) { return parseInt(color.slice(i,i+2),16); });
    return { id: String(c.id), slug: c.slug || String(c.id), name: c.display_name || c.displayName || c.name || String(c.id), color: color, rgb: rgb.join(' '), ink: rgb[0]*.299+rgb[1]*.587+rgb[2]*.114 > 155 ? '#111111' : '#FFFFFF', archived: !!(c.isArchived || c.is_archived), available: false };
  }
  function normalize(payload) {
    if (!Array.isArray(payload.calendars) || !Array.isArray(payload.events)) throw new Error('No calendar snapshot');
    var calendars = payload.calendars.map(lane), index = Object.create(null), rejected = 0;
    calendars.forEach(function (c) { index[c.id] = c; index[c.slug] = c; });
    var seen = Object.create(null), events = [];
    payload.events.forEach(function (raw) {
      try {
        if (!raw.id || !raw.title || seen[raw.id]) throw new Error('Invalid event identity');
        var ref = String(raw.calendar_id || raw.calendarId || raw.calendar || 'unassigned'), c = index[ref];
        if (!c) { c = lane({id: ref, name: ref === 'unassigned' ? 'Unassigned calendar' : ref}); calendars.push(c); index[ref] = c; }
        var allDay = !!(raw.allDay || raw.all_day), start, end, date = raw.date;
        if (allDay) {
          date = date || String(raw.startAt || raw.start_at || '').slice(0,10);
          start = localDate(date); var endDate = raw.endDate || String(raw.endAt || raw.end_at || '').slice(0,10);
          end = endDate ? localDate(endDate) : localDate(date,1);
        } else if (raw.startAt || raw.start_at) {
          start = instant(raw.startAt || raw.start_at); end = instant(raw.endAt || raw.end_at);
        } else {
          start = wall(date, raw.start, raw.timezone);
          var endKey = raw.endDate || date;
          if (!raw.endDate && raw.end < raw.start) { var next = localDate(date,1); endKey = next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-'+String(next.getDate()).padStart(2,'0'); }
          end = raw.end ? wall(endKey, raw.end, raw.timezone) : new Date(+start + 30*60000);
        }
        if (!(end > start)) throw new Error('Invalid event duration');
        seen[raw.id] = true;
        events.push({ id: String(raw.id), title: String(raw.title), start: start, end: end, allDay: allDay, people: [c.id], calendarRef: ref, calendarName: c.name, timezone: raw.timezone || 'UTC', status: raw.status, canceled: /^(canceled|cancelled)$/i.test(raw.status || ''), loc: raw.location || '', notes: (raw.description || '') + (!allDay && !raw.end && !raw.endAt && !raw.end_at ? '\nNo end time supplied by calendar node; shown as a 30-minute block.' : ''), tags: Array.isArray(raw.tags) ? raw.tags : [], alarms: Array.isArray(raw.alarms) ? raw.alarms : [], sourceKind: raw.sourceKind || '' });
      } catch (_) { rejected++; }
    });
    return {calendars: calendars, events: events.sort(function(a,b){return a.start-b.start || a.id.localeCompare(b.id);}), alarms: Array.isArray(payload.alarms) ? payload.alarms : [], rejected: rejected};
  }
  root.CalendarModel = { normalize: normalize, wall: wall };
})(typeof window !== 'undefined' ? window : globalThis);
