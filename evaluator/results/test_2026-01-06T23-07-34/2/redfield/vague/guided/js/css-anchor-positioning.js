var bo = Object.defineProperty, xo = Object.defineProperties;
var Co = Object.getOwnPropertyDescriptors;
var $n = Object.getOwnPropertySymbols;
var wo = Object.prototype.hasOwnProperty, Ao = Object.prototype.propertyIsEnumerable;
var On = (t, e, n) => e in t ? bo(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n, U = (t, e) => {
  for (var n in e || (e = {}))
    wo.call(e, n) && On(t, n, e[n]);
  if ($n)
    for (var n of $n(e))
      Ao.call(e, n) && On(t, n, e[n]);
  return t;
}, G = (t, e) => xo(t, Co(e));
var To = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
var R = (t, e, n) => new Promise((r, s) => {
  var o = (u) => {
    try {
      l(n.next(u));
    } catch (i) {
      s(i);
    }
  }, a = (u) => {
    try {
      l(n.throw(u));
    } catch (i) {
      s(i);
    }
  }, l = (u) => u.done ? r(u.value) : Promise.resolve(u.value).then(o, a);
  l((n = n.apply(t, e)).next());
});
var id = To((fe) => {
  const rn = Math.min, Gt = Math.max, Te = Math.round, de = Math.floor, St = (t) => ({
    x: t,
    y: t
  });
  function vo(t, e) {
    return typeof t == "function" ? t(e) : t;
  }
  function Eo(t) {
    return U({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }, t);
  }
  function $o(t) {
    return typeof t != "number" ? Eo(t) : {
      top: t,
      right: t,
      bottom: t,
      left: t
    };
  }
  function ve(t) {
    const {
      x: e,
      y: n,
      width: r,
      height: s
    } = t;
    return {
      width: r,
      height: s,
      top: n,
      left: e,
      right: e + r,
      bottom: n + s,
      x: e,
      y: n
    };
  }
  function Oo(t, e) {
    return R(this, null, function* () {
      var n;
      e === void 0 && (e = {});
      const {
        x: r,
        y: s,
        platform: o,
        rects: a,
        elements: l,
        strategy: u
      } = t, {
        boundary: i = "clippingAncestors",
        rootBoundary: c = "viewport",
        elementContext: h = "floating",
        altBoundary: f = !1,
        padding: p = 0
      } = vo(e, t), g = $o(p), k = l[f ? h === "floating" ? "reference" : "floating" : h], S = ve(yield o.getClippingRect({
        element: (n = yield o.isElement == null ? void 0 : o.isElement(k)) == null || n ? k : k.contextElement || (yield o.getDocumentElement == null ? void 0 : o.getDocumentElement(l.floating)),
        boundary: i,
        rootBoundary: c,
        strategy: u
      })), x = h === "floating" ? {
        x: r,
        y: s,
        width: a.floating.width,
        height: a.floating.height
      } : a.reference, T = yield o.getOffsetParent == null ? void 0 : o.getOffsetParent(l.floating), M = (yield o.isElement == null ? void 0 : o.isElement(T)) ? (yield o.getScale == null ? void 0 : o.getScale(T)) || {
        x: 1,
        y: 1
      } : {
        x: 1,
        y: 1
      }, et = ve(o.convertOffsetParentRelativeRectToViewportRelativeRect ? yield o.convertOffsetParentRelativeRectToViewportRelativeRect({
        elements: l,
        rect: x,
        offsetParent: T,
        strategy: u
      }) : x);
      return {
        top: (S.top - et.top + g.top) / M.y,
        bottom: (et.bottom - S.bottom + g.bottom) / M.y,
        left: (S.left - et.left + g.left) / M.x,
        right: (et.right - S.right + g.right) / M.x
      };
    });
  }
  function Ie() {
    return typeof window != "undefined";
  }
  function te(t) {
    return Dr(t) ? (t.nodeName || "").toLowerCase() : "#document";
  }
  function it(t) {
    var e;
    return (t == null || (e = t.ownerDocument) == null ? void 0 : e.defaultView) || window;
  }
  function bt(t) {
    var e;
    return (e = (Dr(t) ? t.ownerDocument : t.document) || window.document) == null ? void 0 : e.documentElement;
  }
  function Dr(t) {
    return Ie() ? t instanceof Node || t instanceof it(t).Node : !1;
  }
  function ct(t) {
    return Ie() ? t instanceof Element || t instanceof it(t).Element : !1;
  }
  function yt(t) {
    return Ie() ? t instanceof HTMLElement || t instanceof it(t).HTMLElement : !1;
  }
  function Ln(t) {
    return !Ie() || typeof ShadowRoot == "undefined" ? !1 : t instanceof ShadowRoot || t instanceof it(t).ShadowRoot;
  }
  const Lo = /* @__PURE__ */ new Set(["inline", "contents"]);
  function he(t) {
    const {
      overflow: e,
      overflowX: n,
      overflowY: r,
      display: s
    } = ut(t);
    return /auto|scroll|overlay|hidden|clip/.test(e + r + n) && !Lo.has(s);
  }
  const Po = /* @__PURE__ */ new Set(["table", "td", "th"]);
  function Ro(t) {
    return Po.has(te(t));
  }
  const Io = [":popover-open", ":modal"];
  function _e(t) {
    return Io.some((e) => {
      try {
        return t.matches(e);
      } catch (n) {
        return !1;
      }
    });
  }
  const _o = ["transform", "translate", "scale", "rotate", "perspective"], No = ["transform", "translate", "scale", "rotate", "perspective", "filter"], Do = ["paint", "layout", "strict", "content"];
  function Sn(t) {
    const e = yn(), n = ct(t) ? ut(t) : t;
    return _o.some((r) => n[r] ? n[r] !== "none" : !1) || (n.containerType ? n.containerType !== "normal" : !1) || !e && (n.backdropFilter ? n.backdropFilter !== "none" : !1) || !e && (n.filter ? n.filter !== "none" : !1) || No.some((r) => (n.willChange || "").includes(r)) || Do.some((r) => (n.contain || "").includes(r));
  }
  function Fo(t) {
    let e = Lt(t);
    for (; yt(e) && !Qt(e); ) {
      if (Sn(e))
        return e;
      if (_e(e))
        return null;
      e = Lt(e);
    }
    return null;
  }
  function yn() {
    return typeof CSS == "undefined" || !CSS.supports ? !1 : CSS.supports("-webkit-backdrop-filter", "none");
  }
  const Mo = /* @__PURE__ */ new Set(["html", "body", "#document"]);
  function Qt(t) {
    return Mo.has(te(t));
  }
  function ut(t) {
    return it(t).getComputedStyle(t);
  }
  function Ne(t) {
    return ct(t) ? {
      scrollLeft: t.scrollLeft,
      scrollTop: t.scrollTop
    } : {
      scrollLeft: t.scrollX,
      scrollTop: t.scrollY
    };
  }
  function Lt(t) {
    if (te(t) === "html")
      return t;
    const e = (
      // Step into the shadow DOM of the parent of a slotted node.
      t.assignedSlot || // DOM Element detected.
      t.parentNode || // ShadowRoot detected.
      Ln(t) && t.host || // Fallback.
      bt(t)
    );
    return Ln(e) ? e.host : e;
  }
  function Fr(t) {
    const e = Lt(t);
    return Qt(e) ? t.ownerDocument ? t.ownerDocument.body : t.body : yt(e) && he(e) ? e : Fr(e);
  }
  function le(t, e, n) {
    var r;
    e === void 0 && (e = []), n === void 0 && (n = !0);
    const s = Fr(t), o = s === ((r = t.ownerDocument) == null ? void 0 : r.body), a = it(s);
    if (o) {
      const l = sn(a);
      return e.concat(a, a.visualViewport || [], he(s) ? s : [], l && n ? le(l) : []);
    }
    return e.concat(s, le(s, [], n));
  }
  function sn(t) {
    return t.parent && Object.getPrototypeOf(t.parent) ? t.frameElement : null;
  }
  function Mr(t) {
    const e = ut(t);
    let n = parseFloat(e.width) || 0, r = parseFloat(e.height) || 0;
    const s = yt(t), o = s ? t.offsetWidth : n, a = s ? t.offsetHeight : r, l = Te(n) !== o || Te(r) !== a;
    return l && (n = o, r = a), {
      width: n,
      height: r,
      $: l
    };
  }
  function bn(t) {
    return ct(t) ? t : t.contextElement;
  }
  function qt(t) {
    const e = bn(t);
    if (!yt(e))
      return St(1);
    const n = e.getBoundingClientRect(), {
      width: r,
      height: s,
      $: o
    } = Mr(e);
    let a = (o ? Te(n.width) : n.width) / r, l = (o ? Te(n.height) : n.height) / s;
    return (!a || !Number.isFinite(a)) && (a = 1), (!l || !Number.isFinite(l)) && (l = 1), {
      x: a,
      y: l
    };
  }
  const jo = /* @__PURE__ */ St(0);
  function jr(t) {
    const e = it(t);
    return !yn() || !e.visualViewport ? jo : {
      x: e.visualViewport.offsetLeft,
      y: e.visualViewport.offsetTop
    };
  }
  function Bo(t, e, n) {
    return e === void 0 && (e = !1), !n || e && n !== it(t) ? !1 : e;
  }
  function Dt(t, e, n, r) {
    e === void 0 && (e = !1), n === void 0 && (n = !1);
    const s = t.getBoundingClientRect(), o = bn(t);
    let a = St(1);
    e && (r ? ct(r) && (a = qt(r)) : a = qt(t));
    const l = Bo(o, n, r) ? jr(o) : St(0);
    let u = (s.left + l.x) / a.x, i = (s.top + l.y) / a.y, c = s.width / a.x, h = s.height / a.y;
    if (o) {
      const f = it(o), p = r && ct(r) ? it(r) : r;
      let g = f, m = sn(g);
      for (; m && r && p !== g; ) {
        const k = qt(m), S = m.getBoundingClientRect(), x = ut(m), T = S.left + (m.clientLeft + parseFloat(x.paddingLeft)) * k.x, M = S.top + (m.clientTop + parseFloat(x.paddingTop)) * k.y;
        u *= k.x, i *= k.y, c *= k.x, h *= k.y, u += T, i += M, g = it(m), m = sn(g);
      }
    }
    return ve({
      width: c,
      height: h,
      x: u,
      y: i
    });
  }
  function De(t, e) {
    const n = Ne(t).scrollLeft;
    return e ? e.left + n : Dt(bt(t)).left + n;
  }
  function Br(t, e) {
    const n = t.getBoundingClientRect(), r = n.left + e.scrollLeft - De(t, n), s = n.top + e.scrollTop;
    return {
      x: r,
      y: s
    };
  }
  function Uo(t) {
    let {
      elements: e,
      rect: n,
      offsetParent: r,
      strategy: s
    } = t;
    const o = s === "fixed", a = bt(r), l = e ? _e(e.floating) : !1;
    if (r === a || l && o)
      return n;
    let u = {
      scrollLeft: 0,
      scrollTop: 0
    }, i = St(1);
    const c = St(0), h = yt(r);
    if ((h || !h && !o) && ((te(r) !== "body" || he(a)) && (u = Ne(r)), yt(r))) {
      const p = Dt(r);
      i = qt(r), c.x = p.x + r.clientLeft, c.y = p.y + r.clientTop;
    }
    const f = a && !h && !o ? Br(a, u) : St(0);
    return {
      width: n.width * i.x,
      height: n.height * i.y,
      x: n.x * i.x - u.scrollLeft * i.x + c.x + f.x,
      y: n.y * i.y - u.scrollTop * i.y + c.y + f.y
    };
  }
  function Wo(t) {
    return Array.from(t.getClientRects());
  }
  function zo(t) {
    const e = bt(t), n = Ne(t), r = t.ownerDocument.body, s = Gt(e.scrollWidth, e.clientWidth, r.scrollWidth, r.clientWidth), o = Gt(e.scrollHeight, e.clientHeight, r.scrollHeight, r.clientHeight);
    let a = -n.scrollLeft + De(t);
    const l = -n.scrollTop;
    return ut(r).direction === "rtl" && (a += Gt(e.clientWidth, r.clientWidth) - s), {
      width: s,
      height: o,
      x: a,
      y: l
    };
  }
  const Pn = 25;
  function Ho(t, e) {
    const n = it(t), r = bt(t), s = n.visualViewport;
    let o = r.clientWidth, a = r.clientHeight, l = 0, u = 0;
    if (s) {
      o = s.width, a = s.height;
      const c = yn();
      (!c || c && e === "fixed") && (l = s.offsetLeft, u = s.offsetTop);
    }
    const i = De(r);
    if (i <= 0) {
      const c = r.ownerDocument, h = c.body, f = getComputedStyle(h), p = c.compatMode === "CSS1Compat" && parseFloat(f.marginLeft) + parseFloat(f.marginRight) || 0, g = Math.abs(r.clientWidth - h.clientWidth - p);
      g <= Pn && (o -= g);
    } else i <= Pn && (o += i);
    return {
      width: o,
      height: a,
      x: l,
      y: u
    };
  }
  const Vo = /* @__PURE__ */ new Set(["absolute", "fixed"]);
  function Go(t, e) {
    const n = Dt(t, !0, e === "fixed"), r = n.top + t.clientTop, s = n.left + t.clientLeft, o = yt(t) ? qt(t) : St(1), a = t.clientWidth * o.x, l = t.clientHeight * o.y, u = s * o.x, i = r * o.y;
    return {
      width: a,
      height: l,
      x: u,
      y: i
    };
  }
  function Rn(t, e, n) {
    let r;
    if (e === "viewport")
      r = Ho(t, n);
    else if (e === "document")
      r = zo(bt(t));
    else if (ct(e))
      r = Go(e, n);
    else {
      const s = jr(t);
      r = {
        x: e.x - s.x,
        y: e.y - s.y,
        width: e.width,
        height: e.height
      };
    }
    return ve(r);
  }
  function Ur(t, e) {
    const n = Lt(t);
    return n === e || !ct(n) || Qt(n) ? !1 : ut(n).position === "fixed" || Ur(n, e);
  }
  function qo(t, e) {
    const n = e.get(t);
    if (n)
      return n;
    let r = le(t, [], !1).filter((l) => ct(l) && te(l) !== "body"), s = null;
    const o = ut(t).position === "fixed";
    let a = o ? Lt(t) : t;
    for (; ct(a) && !Qt(a); ) {
      const l = ut(a), u = Sn(a);
      !u && l.position === "fixed" && (s = null), (o ? !u && !s : !u && l.position === "static" && !!s && Vo.has(s.position) || he(a) && !u && Ur(t, a)) ? r = r.filter((c) => c !== a) : s = l, a = Lt(a);
    }
    return e.set(t, r), r;
  }
  function Ko(t) {
    let {
      element: e,
      boundary: n,
      rootBoundary: r,
      strategy: s
    } = t;
    const a = [...n === "clippingAncestors" ? _e(e) ? [] : qo(e, this._c) : [].concat(n), r], l = a[0], u = a.reduce((i, c) => {
      const h = Rn(e, c, s);
      return i.top = Gt(h.top, i.top), i.right = rn(h.right, i.right), i.bottom = rn(h.bottom, i.bottom), i.left = Gt(h.left, i.left), i;
    }, Rn(e, l, s));
    return {
      width: u.right - u.left,
      height: u.bottom - u.top,
      x: u.left,
      y: u.top
    };
  }
  function Qo(t) {
    const {
      width: e,
      height: n
    } = Mr(t);
    return {
      width: e,
      height: n
    };
  }
  function Yo(t, e, n) {
    const r = yt(e), s = bt(e), o = n === "fixed", a = Dt(t, !0, o, e);
    let l = {
      scrollLeft: 0,
      scrollTop: 0
    };
    const u = St(0);
    function i() {
      u.x = De(s);
    }
    if (r || !r && !o)
      if ((te(e) !== "body" || he(s)) && (l = Ne(e)), r) {
        const p = Dt(e, !0, o, e);
        u.x = p.x + e.clientLeft, u.y = p.y + e.clientTop;
      } else s && i();
    o && !r && s && i();
    const c = s && !r && !o ? Br(s, l) : St(0), h = a.left + l.scrollLeft - u.x - c.x, f = a.top + l.scrollTop - u.y - c.y;
    return {
      x: h,
      y: f,
      width: a.width,
      height: a.height
    };
  }
  function Me(t) {
    return ut(t).position === "static";
  }
  function In(t, e) {
    if (!yt(t) || ut(t).position === "fixed")
      return null;
    if (e)
      return e(t);
    let n = t.offsetParent;
    return bt(t) === n && (n = n.ownerDocument.body), n;
  }
  function Wr(t, e) {
    const n = it(t);
    if (_e(t))
      return n;
    if (!yt(t)) {
      let s = Lt(t);
      for (; s && !Qt(s); ) {
        if (ct(s) && !Me(s))
          return s;
        s = Lt(s);
      }
      return n;
    }
    let r = In(t, e);
    for (; r && Ro(r) && Me(r); )
      r = In(r, e);
    return r && Qt(r) && Me(r) && !Sn(r) ? n : r || Fo(t) || n;
  }
  const Xo = function(t) {
    return R(this, null, function* () {
      const e = this.getOffsetParent || Wr, n = this.getDimensions, r = yield n(t.floating);
      return {
        reference: Yo(t.reference, yield e(t.floating), t.strategy),
        floating: {
          x: 0,
          y: 0,
          width: r.width,
          height: r.height
        }
      };
    });
  };
  function Jo(t) {
    return ut(t).direction === "rtl";
  }
  const H = {
    convertOffsetParentRelativeRectToViewportRelativeRect: Uo,
    getDocumentElement: bt,
    getClippingRect: Ko,
    getOffsetParent: Wr,
    getElementRects: Xo,
    getClientRects: Wo,
    getDimensions: Qo,
    getScale: qt,
    isElement: ct,
    isRTL: Jo
  };
  function zr(t, e) {
    return t.x === e.x && t.y === e.y && t.width === e.width && t.height === e.height;
  }
  function Zo(t, e) {
    let n = null, r;
    const s = bt(t);
    function o() {
      var l;
      clearTimeout(r), (l = n) == null || l.disconnect(), n = null;
    }
    function a(l, u) {
      l === void 0 && (l = !1), u === void 0 && (u = 1), o();
      const i = t.getBoundingClientRect(), {
        left: c,
        top: h,
        width: f,
        height: p
      } = i;
      if (l || e(), !f || !p)
        return;
      const g = de(h), m = de(s.clientWidth - (c + f)), k = de(s.clientHeight - (h + p)), S = de(c), T = {
        rootMargin: -g + "px " + -m + "px " + -k + "px " + -S + "px",
        threshold: Gt(0, rn(1, u)) || 1
      };
      let M = !0;
      function et(w) {
        const C = w[0].intersectionRatio;
        if (C !== u) {
          if (!M)
            return a();
          C ? a(!1, C) : r = setTimeout(() => {
            a(!1, 1e-7);
          }, 1e3);
        }
        C === 1 && !zr(i, t.getBoundingClientRect()) && a(), M = !1;
      }
      try {
        n = new IntersectionObserver(et, G(U({}, T), {
          // Handle <iframe>s
          root: s.ownerDocument
        }));
      } catch (w) {
        n = new IntersectionObserver(et, T);
      }
      n.observe(t);
    }
    return a(!0), o;
  }
  function on(t, e, n, r) {
    r === void 0 && (r = {});
    const {
      ancestorScroll: s = !0,
      ancestorResize: o = !0,
      elementResize: a = typeof ResizeObserver == "function",
      layoutShift: l = typeof IntersectionObserver == "function",
      animationFrame: u = !1
    } = r, i = bn(t), c = s || o ? [...i ? le(i) : [], ...le(e)] : [];
    c.forEach((S) => {
      s && S.addEventListener("scroll", n, {
        passive: !0
      }), o && S.addEventListener("resize", n);
    });
    const h = i && l ? Zo(i, n) : null;
    let f = -1, p = null;
    a && (p = new ResizeObserver((S) => {
      let [x] = S;
      x && x.target === i && p && (p.unobserve(e), cancelAnimationFrame(f), f = requestAnimationFrame(() => {
        var T;
        (T = p) == null || T.observe(e);
      })), n();
    }), i && !u && p.observe(i), p.observe(e));
    let g, m = u ? Dt(t) : null;
    u && k();
    function k() {
      const S = Dt(t);
      m && !zr(m, S) && n(), m = S, g = requestAnimationFrame(k);
    }
    return n(), () => {
      var S;
      c.forEach((x) => {
        s && x.removeEventListener("scroll", n), o && x.removeEventListener("resize", n);
      }), h == null || h(), (S = p) == null || S.disconnect(), p = null, u && cancelAnimationFrame(g);
    };
  }
  const ta = Oo;
  let zt = null;
  class q {
    static createItem(e) {
      return {
        prev: null,
        next: null,
        data: e
      };
    }
    constructor() {
      this.head = null, this.tail = null, this.cursor = null;
    }
    createItem(e) {
      return q.createItem(e);
    }
    // cursor helpers
    allocateCursor(e, n) {
      let r;
      return zt !== null ? (r = zt, zt = zt.cursor, r.prev = e, r.next = n, r.cursor = this.cursor) : r = {
        prev: e,
        next: n,
        cursor: this.cursor
      }, this.cursor = r, r;
    }
    releaseCursor() {
      const { cursor: e } = this;
      this.cursor = e.cursor, e.prev = null, e.next = null, e.cursor = zt, zt = e;
    }
    updateCursors(e, n, r, s) {
      let { cursor: o } = this;
      for (; o !== null; )
        o.prev === e && (o.prev = n), o.next === r && (o.next = s), o = o.cursor;
    }
    *[Symbol.iterator]() {
      for (let e = this.head; e !== null; e = e.next)
        yield e.data;
    }
    // getters
    get size() {
      let e = 0;
      for (let n = this.head; n !== null; n = n.next)
        e++;
      return e;
    }
    get isEmpty() {
      return this.head === null;
    }
    get first() {
      return this.head && this.head.data;
    }
    get last() {
      return this.tail && this.tail.data;
    }
    // convertors
    fromArray(e) {
      let n = null;
      this.head = null;
      for (let r of e) {
        const s = q.createItem(r);
        n !== null ? n.next = s : this.head = s, s.prev = n, n = s;
      }
      return this.tail = n, this;
    }
    toArray() {
      return [...this];
    }
    toJSON() {
      return [...this];
    }
    // array-like methods
    forEach(e, n = this) {
      const r = this.allocateCursor(null, this.head);
      for (; r.next !== null; ) {
        const s = r.next;
        r.next = s.next, e.call(n, s.data, s, this);
      }
      this.releaseCursor();
    }
    forEachRight(e, n = this) {
      const r = this.allocateCursor(this.tail, null);
      for (; r.prev !== null; ) {
        const s = r.prev;
        r.prev = s.prev, e.call(n, s.data, s, this);
      }
      this.releaseCursor();
    }
    reduce(e, n, r = this) {
      let s = this.allocateCursor(null, this.head), o = n, a;
      for (; s.next !== null; )
        a = s.next, s.next = a.next, o = e.call(r, o, a.data, a, this);
      return this.releaseCursor(), o;
    }
    reduceRight(e, n, r = this) {
      let s = this.allocateCursor(this.tail, null), o = n, a;
      for (; s.prev !== null; )
        a = s.prev, s.prev = a.prev, o = e.call(r, o, a.data, a, this);
      return this.releaseCursor(), o;
    }
    some(e, n = this) {
      for (let r = this.head; r !== null; r = r.next)
        if (e.call(n, r.data, r, this))
          return !0;
      return !1;
    }
    map(e, n = this) {
      const r = new q();
      for (let s = this.head; s !== null; s = s.next)
        r.appendData(e.call(n, s.data, s, this));
      return r;
    }
    filter(e, n = this) {
      const r = new q();
      for (let s = this.head; s !== null; s = s.next)
        e.call(n, s.data, s, this) && r.appendData(s.data);
      return r;
    }
    nextUntil(e, n, r = this) {
      if (e === null)
        return;
      const s = this.allocateCursor(null, e);
      for (; s.next !== null; ) {
        const o = s.next;
        if (s.next = o.next, n.call(r, o.data, o, this))
          break;
      }
      this.releaseCursor();
    }
    prevUntil(e, n, r = this) {
      if (e === null)
        return;
      const s = this.allocateCursor(e, null);
      for (; s.prev !== null; ) {
        const o = s.prev;
        if (s.prev = o.prev, n.call(r, o.data, o, this))
          break;
      }
      this.releaseCursor();
    }
    // mutation
    clear() {
      this.head = null, this.tail = null;
    }
    copy() {
      const e = new q();
      for (let n of this)
        e.appendData(n);
      return e;
    }
    prepend(e) {
      return this.updateCursors(null, e, this.head, e), this.head !== null ? (this.head.prev = e, e.next = this.head) : this.tail = e, this.head = e, this;
    }
    prependData(e) {
      return this.prepend(q.createItem(e));
    }
    append(e) {
      return this.insert(e);
    }
    appendData(e) {
      return this.insert(q.createItem(e));
    }
    insert(e, n = null) {
      if (n !== null)
        if (this.updateCursors(n.prev, e, n, e), n.prev === null) {
          if (this.head !== n)
            throw new Error("before doesn't belong to list");
          this.head = e, n.prev = e, e.next = n, this.updateCursors(null, e);
        } else
          n.prev.next = e, e.prev = n.prev, n.prev = e, e.next = n;
      else
        this.updateCursors(this.tail, e, null, e), this.tail !== null ? (this.tail.next = e, e.prev = this.tail) : this.head = e, this.tail = e;
      return this;
    }
    insertData(e, n) {
      return this.insert(q.createItem(e), n);
    }
    remove(e) {
      if (this.updateCursors(e, e.prev, e, e.next), e.prev !== null)
        e.prev.next = e.next;
      else {
        if (this.head !== e)
          throw new Error("item doesn't belong to list");
        this.head = e.next;
      }
      if (e.next !== null)
        e.next.prev = e.prev;
      else {
        if (this.tail !== e)
          throw new Error("item doesn't belong to list");
        this.tail = e.prev;
      }
      return e.prev = null, e.next = null, e;
    }
    push(e) {
      this.insert(q.createItem(e));
    }
    pop() {
      return this.tail !== null ? this.remove(this.tail) : null;
    }
    unshift(e) {
      this.prepend(q.createItem(e));
    }
    shift() {
      return this.head !== null ? this.remove(this.head) : null;
    }
    prependList(e) {
      return this.insertList(e, this.head);
    }
    appendList(e) {
      return this.insertList(e);
    }
    insertList(e, n) {
      return e.head === null ? this : (n != null ? (this.updateCursors(n.prev, e.tail, n, e.head), n.prev !== null ? (n.prev.next = e.head, e.head.prev = n.prev) : this.head = e.head, n.prev = e.tail, e.tail.next = n) : (this.updateCursors(this.tail, e.tail, null, e.head), this.tail !== null ? (this.tail.next = e.head, e.head.prev = this.tail) : this.head = e.head, this.tail = e.tail), e.head = null, e.tail = null, this);
    }
    replace(e, n) {
      "head" in n ? this.insertList(n, e) : this.insert(n, e), this.remove(e);
    }
  }
  function Ee(t) {
    const e = {};
    for (const n of Object.keys(t)) {
      let r = t[n];
      r && (Array.isArray(r) || r instanceof q ? r = r.map(Ee) : r.constructor === Object && (r = Ee(r))), e[n] = r;
    }
    return e;
  }
  const vt = 0, d = 1, A = 2, z = 3, _ = 4, At = 5, ea = 6, Q = 7, at = 8, O = 9, b = 10, F = 11, E = 12, W = 13, Fe = 14, nt = 15, X = 16, tt = 17, ft = 18, ee = 19, ce = 20, I = 21, y = 22, ht = 23, Yt = 24, Y = 25, na = 0;
  function st(t) {
    return t >= 48 && t <= 57;
  }
  function Xt(t) {
    return st(t) || // 0 .. 9
    t >= 65 && t <= 70 || // A .. F
    t >= 97 && t <= 102;
  }
  function xn(t) {
    return t >= 65 && t <= 90;
  }
  function ra(t) {
    return t >= 97 && t <= 122;
  }
  function sa(t) {
    return xn(t) || ra(t);
  }
  function ia(t) {
    return t >= 128;
  }
  function $e(t) {
    return sa(t) || ia(t) || t === 95;
  }
  function Hr(t) {
    return $e(t) || st(t) || t === 45;
  }
  function oa(t) {
    return t >= 0 && t <= 8 || t === 11 || t >= 14 && t <= 31 || t === 127;
  }
  function Oe(t) {
    return t === 10 || t === 13 || t === 12;
  }
  function Ft(t) {
    return Oe(t) || t === 32 || t === 9;
  }
  function kt(t, e) {
    return !(t !== 92 || Oe(e) || e === na);
  }
  function je(t, e, n) {
    return t === 45 ? $e(e) || e === 45 || kt(e, n) : $e(t) ? !0 : t === 92 ? kt(t, e) : !1;
  }
  function Be(t, e, n) {
    return t === 43 || t === 45 ? st(e) ? 2 : e === 46 && st(n) ? 3 : 0 : t === 46 ? st(e) ? 2 : 0 : st(t) ? 1 : 0;
  }
  function Vr(t) {
    return t === 65279 || t === 65534 ? 1 : 0;
  }
  const an = new Array(128), aa = 128, be = 130, Gr = 131, Cn = 132, qr = 133;
  for (let t = 0; t < an.length; t++)
    an[t] = Ft(t) && be || st(t) && Gr || $e(t) && Cn || oa(t) && qr || t || aa;
  function Ue(t) {
    return t < 128 ? an[t] : Cn;
  }
  function Kt(t, e) {
    return e < t.length ? t.charCodeAt(e) : 0;
  }
  function ln(t, e, n) {
    return n === 13 && Kt(t, e + 1) === 10 ? 2 : 1;
  }
  function Kr(t, e, n) {
    let r = t.charCodeAt(e);
    return xn(r) && (r = r | 32), r === n;
  }
  function Le(t, e, n, r) {
    if (n - e !== r.length || e < 0 || n > t.length)
      return !1;
    for (let s = e; s < n; s++) {
      const o = r.charCodeAt(s - e);
      let a = t.charCodeAt(s);
      if (xn(a) && (a = a | 32), a !== o)
        return !1;
    }
    return !0;
  }
  function la(t, e) {
    for (; e >= 0 && Ft(t.charCodeAt(e)); e--)
      ;
    return e + 1;
  }
  function ge(t, e) {
    for (; e < t.length && Ft(t.charCodeAt(e)); e++)
      ;
    return e;
  }
  function We(t, e) {
    for (; e < t.length && st(t.charCodeAt(e)); e++)
      ;
    return e;
  }
  function Jt(t, e) {
    if (e += 2, Xt(Kt(t, e - 1))) {
      for (const r = Math.min(t.length, e + 5); e < r && Xt(Kt(t, e)); e++)
        ;
      const n = Kt(t, e);
      Ft(n) && (e += ln(t, e, n));
    }
    return e;
  }
  function me(t, e) {
    for (; e < t.length; e++) {
      const n = t.charCodeAt(e);
      if (!Hr(n)) {
        if (kt(n, Kt(t, e + 1))) {
          e = Jt(t, e) - 1;
          continue;
        }
        break;
      }
    }
    return e;
  }
  function Qr(t, e) {
    let n = t.charCodeAt(e);
    if ((n === 43 || n === 45) && (n = t.charCodeAt(e += 1)), st(n) && (e = We(t, e + 1), n = t.charCodeAt(e)), n === 46 && st(t.charCodeAt(e + 1)) && (e += 2, e = We(t, e)), Kr(
      t,
      e,
      101
      /* e */
    )) {
      let r = 0;
      n = t.charCodeAt(e + 1), (n === 45 || n === 43) && (r = 1, n = t.charCodeAt(e + 2)), st(n) && (e = We(t, e + 1 + r + 1));
    }
    return e;
  }
  function ze(t, e) {
    for (; e < t.length; e++) {
      const n = t.charCodeAt(e);
      if (n === 41) {
        e++;
        break;
      }
      kt(n, Kt(t, e + 1)) && (e = Jt(t, e));
    }
    return e;
  }
  function Yr(t) {
    if (t.length === 1 && !Xt(t.charCodeAt(0)))
      return t[0];
    let e = parseInt(t, 16);
    return (e === 0 || // If this number is zero,
    e >= 55296 && e <= 57343 || // or is for a surrogate,
    e > 1114111) && (e = 65533), String.fromCodePoint(e);
  }
  const Xr = [
    "EOF-token",
    "ident-token",
    "function-token",
    "at-keyword-token",
    "hash-token",
    "string-token",
    "bad-string-token",
    "url-token",
    "bad-url-token",
    "delim-token",
    "number-token",
    "percentage-token",
    "dimension-token",
    "whitespace-token",
    "CDO-token",
    "CDC-token",
    "colon-token",
    "semicolon-token",
    "comma-token",
    "[-token",
    "]-token",
    "(-token",
    ")-token",
    "{-token",
    "}-token",
    "comment-token"
  ], ca = 16 * 1024;
  function Pe(t = null, e) {
    return t === null || t.length < e ? new Uint32Array(Math.max(e + 1024, ca)) : t;
  }
  const _n = 10, ua = 12, Nn = 13;
  function Dn(t) {
    const e = t.source, n = e.length, r = e.length > 0 ? Vr(e.charCodeAt(0)) : 0, s = Pe(t.lines, n), o = Pe(t.columns, n);
    let a = t.startLine, l = t.startColumn;
    for (let u = r; u < n; u++) {
      const i = e.charCodeAt(u);
      s[u] = a, o[u] = l++, (i === _n || i === Nn || i === ua) && (i === Nn && u + 1 < n && e.charCodeAt(u + 1) === _n && (u++, s[u] = a, o[u] = l), a++, l = 1);
    }
    s[n] = a, o[n] = l, t.lines = s, t.columns = o, t.computed = !0;
  }
  class ha {
    constructor(e, n, r, s) {
      this.setSource(e, n, r, s), this.lines = null, this.columns = null;
    }
    setSource(e = "", n = 0, r = 1, s = 1) {
      this.source = e, this.startOffset = n, this.startLine = r, this.startColumn = s, this.computed = !1;
    }
    getLocation(e, n) {
      return this.computed || Dn(this), {
        source: n,
        offset: this.startOffset + e,
        line: this.lines[e],
        column: this.columns[e]
      };
    }
    getLocationRange(e, n, r) {
      return this.computed || Dn(this), {
        source: r,
        start: {
          offset: this.startOffset + e,
          line: this.lines[e],
          column: this.columns[e]
        },
        end: {
          offset: this.startOffset + n,
          line: this.lines[n],
          column: this.columns[n]
        }
      };
    }
  }
  const dt = 16777215, gt = 24, Mt = new Uint8Array(32);
  Mt[A] = y;
  Mt[I] = y;
  Mt[ee] = ce;
  Mt[ht] = Yt;
  function Fn(t) {
    return Mt[t] !== 0;
  }
  class fa {
    constructor(e, n) {
      this.setSource(e, n);
    }
    reset() {
      this.eof = !1, this.tokenIndex = -1, this.tokenType = 0, this.tokenStart = this.firstCharOffset, this.tokenEnd = this.firstCharOffset;
    }
    setSource(e = "", n = () => {
    }) {
      e = String(e || "");
      const r = e.length, s = Pe(this.offsetAndType, e.length + 1), o = Pe(this.balance, e.length + 1);
      let a = 0, l = -1, u = 0, i = e.length;
      this.offsetAndType = null, this.balance = null, o.fill(0), n(e, (c, h, f) => {
        const p = a++;
        if (s[p] = c << gt | f, l === -1 && (l = h), o[p] = i, c === u) {
          const g = o[i];
          o[i] = p, i = g, u = Mt[s[g] >> gt];
        } else Fn(c) && (i = p, u = Mt[c]);
      }), s[a] = vt << gt | r, o[a] = a;
      for (let c = 0; c < a; c++) {
        const h = o[c];
        if (h <= c) {
          const f = o[h];
          f !== c && (o[c] = f);
        } else h > a && (o[c] = a);
      }
      this.source = e, this.firstCharOffset = l === -1 ? 0 : l, this.tokenCount = a, this.offsetAndType = s, this.balance = o, this.reset(), this.next();
    }
    lookupType(e) {
      return e += this.tokenIndex, e < this.tokenCount ? this.offsetAndType[e] >> gt : vt;
    }
    lookupTypeNonSC(e) {
      for (let n = this.tokenIndex; n < this.tokenCount; n++) {
        const r = this.offsetAndType[n] >> gt;
        if (r !== W && r !== Y && e-- === 0)
          return r;
      }
      return vt;
    }
    lookupOffset(e) {
      return e += this.tokenIndex, e < this.tokenCount ? this.offsetAndType[e - 1] & dt : this.source.length;
    }
    lookupOffsetNonSC(e) {
      for (let n = this.tokenIndex; n < this.tokenCount; n++) {
        const r = this.offsetAndType[n] >> gt;
        if (r !== W && r !== Y && e-- === 0)
          return n - this.tokenIndex;
      }
      return vt;
    }
    lookupValue(e, n) {
      return e += this.tokenIndex, e < this.tokenCount ? Le(
        this.source,
        this.offsetAndType[e - 1] & dt,
        this.offsetAndType[e] & dt,
        n
      ) : !1;
    }
    getTokenStart(e) {
      return e === this.tokenIndex ? this.tokenStart : e > 0 ? e < this.tokenCount ? this.offsetAndType[e - 1] & dt : this.offsetAndType[this.tokenCount] & dt : this.firstCharOffset;
    }
    substrToCursor(e) {
      return this.source.substring(e, this.tokenStart);
    }
    isBalanceEdge(e) {
      return this.balance[this.tokenIndex] < e;
    }
    isDelim(e, n) {
      return n ? this.lookupType(n) === O && this.source.charCodeAt(this.lookupOffset(n)) === e : this.tokenType === O && this.source.charCodeAt(this.tokenStart) === e;
    }
    skip(e) {
      let n = this.tokenIndex + e;
      n < this.tokenCount ? (this.tokenIndex = n, this.tokenStart = this.offsetAndType[n - 1] & dt, n = this.offsetAndType[n], this.tokenType = n >> gt, this.tokenEnd = n & dt) : (this.tokenIndex = this.tokenCount, this.next());
    }
    next() {
      let e = this.tokenIndex + 1;
      e < this.tokenCount ? (this.tokenIndex = e, this.tokenStart = this.tokenEnd, e = this.offsetAndType[e], this.tokenType = e >> gt, this.tokenEnd = e & dt) : (this.eof = !0, this.tokenIndex = this.tokenCount, this.tokenType = vt, this.tokenStart = this.tokenEnd = this.source.length);
    }
    skipSC() {
      for (; this.tokenType === W || this.tokenType === Y; )
        this.next();
    }
    skipUntilBalanced(e, n) {
      let r = e, s = 0, o = 0;
      t:
        for (; r < this.tokenCount; r++) {
          if (s = this.balance[r], s < e)
            break t;
          switch (o = r > 0 ? this.offsetAndType[r - 1] & dt : this.firstCharOffset, n(this.source.charCodeAt(o))) {
            case 1:
              break t;
            case 2:
              r++;
              break t;
            default:
              Fn(this.offsetAndType[r] >> gt) && (r = s);
          }
        }
      this.skip(r - this.tokenIndex);
    }
    forEachToken(e) {
      for (let n = 0, r = this.firstCharOffset; n < this.tokenCount; n++) {
        const s = r, o = this.offsetAndType[n], a = o & dt, l = o >> gt;
        r = a, e(l, s, a, n);
      }
    }
    dump() {
      const e = new Array(this.tokenCount);
      return this.forEachToken((n, r, s, o) => {
        e[o] = {
          idx: o,
          type: Xr[n],
          chunk: this.source.substring(r, s),
          balance: this.balance[o]
        };
      }), e;
    }
  }
  function Jr(t, e) {
    function n(h) {
      return h < l ? t.charCodeAt(h) : 0;
    }
    function r() {
      if (i = Qr(t, i), je(n(i), n(i + 1), n(i + 2))) {
        c = E, i = me(t, i);
        return;
      }
      if (n(i) === 37) {
        c = F, i++;
        return;
      }
      c = b;
    }
    function s() {
      const h = i;
      if (i = me(t, i), Le(t, h, i, "url") && n(i) === 40) {
        if (i = ge(t, i + 1), n(i) === 34 || n(i) === 39) {
          c = A, i = h + 4;
          return;
        }
        a();
        return;
      }
      if (n(i) === 40) {
        c = A, i++;
        return;
      }
      c = d;
    }
    function o(h) {
      for (h || (h = n(i++)), c = At; i < t.length; i++) {
        const f = t.charCodeAt(i);
        switch (Ue(f)) {
          // ending code point
          case h:
            i++;
            return;
          // EOF
          // case EofCategory:
          // This is a parse error. Return the <string-token>.
          // return;
          // newline
          case be:
            if (Oe(f)) {
              i += ln(t, i, f), c = ea;
              return;
            }
            break;
          // U+005C REVERSE SOLIDUS (\)
          case 92:
            if (i === t.length - 1)
              break;
            const p = n(i + 1);
            Oe(p) ? i += ln(t, i + 1, p) : kt(f, p) && (i = Jt(t, i) - 1);
            break;
        }
      }
    }
    function a() {
      for (c = Q, i = ge(t, i); i < t.length; i++) {
        const h = t.charCodeAt(i);
        switch (Ue(h)) {
          // U+0029 RIGHT PARENTHESIS ())
          case 41:
            i++;
            return;
          // EOF
          // case EofCategory:
          // This is a parse error. Return the <url-token>.
          // return;
          // whitespace
          case be:
            if (i = ge(t, i), n(i) === 41 || i >= t.length) {
              i < t.length && i++;
              return;
            }
            i = ze(t, i), c = at;
            return;
          // U+0022 QUOTATION MARK (")
          // U+0027 APOSTROPHE (')
          // U+0028 LEFT PARENTHESIS (()
          // non-printable code point
          case 34:
          case 39:
          case 40:
          case qr:
            i = ze(t, i), c = at;
            return;
          // U+005C REVERSE SOLIDUS (\)
          case 92:
            if (kt(h, n(i + 1))) {
              i = Jt(t, i) - 1;
              break;
            }
            i = ze(t, i), c = at;
            return;
        }
      }
    }
    t = String(t || "");
    const l = t.length;
    let u = Vr(n(0)), i = u, c;
    for (; i < l; ) {
      const h = t.charCodeAt(i);
      switch (Ue(h)) {
        // whitespace
        case be:
          c = W, i = ge(t, i + 1);
          break;
        // U+0022 QUOTATION MARK (")
        case 34:
          o();
          break;
        // U+0023 NUMBER SIGN (#)
        case 35:
          Hr(n(i + 1)) || kt(n(i + 1), n(i + 2)) ? (c = _, i = me(t, i + 1)) : (c = O, i++);
          break;
        // U+0027 APOSTROPHE (')
        case 39:
          o();
          break;
        // U+0028 LEFT PARENTHESIS (()
        case 40:
          c = I, i++;
          break;
        // U+0029 RIGHT PARENTHESIS ())
        case 41:
          c = y, i++;
          break;
        // U+002B PLUS SIGN (+)
        case 43:
          Be(h, n(i + 1), n(i + 2)) ? r() : (c = O, i++);
          break;
        // U+002C COMMA (,)
        case 44:
          c = ft, i++;
          break;
        // U+002D HYPHEN-MINUS (-)
        case 45:
          Be(h, n(i + 1), n(i + 2)) ? r() : n(i + 1) === 45 && n(i + 2) === 62 ? (c = nt, i = i + 3) : je(h, n(i + 1), n(i + 2)) ? s() : (c = O, i++);
          break;
        // U+002E FULL STOP (.)
        case 46:
          Be(h, n(i + 1), n(i + 2)) ? r() : (c = O, i++);
          break;
        // U+002F SOLIDUS (/)
        case 47:
          n(i + 1) === 42 ? (c = Y, i = t.indexOf("*/", i + 2), i = i === -1 ? t.length : i + 2) : (c = O, i++);
          break;
        // U+003A COLON (:)
        case 58:
          c = X, i++;
          break;
        // U+003B SEMICOLON (;)
        case 59:
          c = tt, i++;
          break;
        // U+003C LESS-THAN SIGN (<)
        case 60:
          n(i + 1) === 33 && n(i + 2) === 45 && n(i + 3) === 45 ? (c = Fe, i = i + 4) : (c = O, i++);
          break;
        // U+0040 COMMERCIAL AT (@)
        case 64:
          je(n(i + 1), n(i + 2), n(i + 3)) ? (c = z, i = me(t, i + 1)) : (c = O, i++);
          break;
        // U+005B LEFT SQUARE BRACKET ([)
        case 91:
          c = ee, i++;
          break;
        // U+005C REVERSE SOLIDUS (\)
        case 92:
          kt(h, n(i + 1)) ? s() : (c = O, i++);
          break;
        // U+005D RIGHT SQUARE BRACKET (])
        case 93:
          c = ce, i++;
          break;
        // U+007B LEFT CURLY BRACKET ({)
        case 123:
          c = ht, i++;
          break;
        // U+007D RIGHT CURLY BRACKET (})
        case 125:
          c = Yt, i++;
          break;
        // digit
        case Gr:
          r();
          break;
        // name-start code point
        case Cn:
          s();
          break;
        // EOF
        // case EofCategory:
        // Return an <EOF-token>.
        // break;
        // anything else
        default:
          c = O, i++;
      }
      e(c, u, u = i);
    }
  }
  const Mn = 45;
  function pa(t, e) {
    return e = e || 0, t.length - e >= 2 && t.charCodeAt(e) === Mn && t.charCodeAt(e + 1) === Mn;
  }
  const cn = 92, Zr = 34, da = 39;
  function ts(t) {
    const e = t.length, n = t.charCodeAt(0), r = n === Zr || n === da ? 1 : 0, s = r === 1 && e > 1 && t.charCodeAt(e - 1) === n ? e - 2 : e - 1;
    let o = "";
    for (let a = r; a <= s; a++) {
      let l = t.charCodeAt(a);
      if (l === cn) {
        if (a === s) {
          a !== e - 1 && (o = t.substr(a + 1));
          break;
        }
        if (l = t.charCodeAt(++a), kt(cn, l)) {
          const u = a - 1, i = Jt(t, u);
          a = i - 1, o += Yr(t.substring(u + 1, i));
        } else
          l === 13 && t.charCodeAt(a + 1) === 10 && a++;
      } else
        o += t[a];
    }
    return o;
  }
  function ga(t, e) {
    const r = Zr;
    let s = "", o = !1;
    for (let a = 0; a < t.length; a++) {
      const l = t.charCodeAt(a);
      if (l === 0) {
        s += "�";
        continue;
      }
      if (l <= 31 || l === 127) {
        s += "\\" + l.toString(16), o = !0;
        continue;
      }
      l === r || l === cn ? (s += "\\" + t.charAt(a), o = !1) : (o && (Xt(l) || Ft(l)) && (s += " "), s += t.charAt(a), o = !1);
    }
    return '"' + s + '"';
  }
  const ma = 32, un = 92, ka = 34, Sa = 39, ya = 40, es = 41;
  function ba(t) {
    const e = t.length;
    let n = 4, r = t.charCodeAt(e - 1) === es ? e - 2 : e - 1, s = "";
    for (; n < r && Ft(t.charCodeAt(n)); )
      n++;
    for (; n < r && Ft(t.charCodeAt(r)); )
      r--;
    for (let o = n; o <= r; o++) {
      let a = t.charCodeAt(o);
      if (a === un) {
        if (o === r) {
          o !== e - 1 && (s = t.substr(o + 1));
          break;
        }
        if (a = t.charCodeAt(++o), kt(un, a)) {
          const l = o - 1, u = Jt(t, l);
          o = u - 1, s += Yr(t.substring(l + 1, u));
        } else
          a === 13 && t.charCodeAt(o + 1) === 10 && o++;
      } else
        s += t[o];
    }
    return s;
  }
  function xa(t) {
    let e = "", n = !1;
    for (let r = 0; r < t.length; r++) {
      const s = t.charCodeAt(r);
      if (s === 0) {
        e += "�";
        continue;
      }
      if (s <= 31 || s === 127) {
        e += "\\" + s.toString(16), n = !0;
        continue;
      }
      s === ma || s === un || s === ka || s === Sa || s === ya || s === es ? (e += "\\" + t.charAt(r), n = !1) : (n && Xt(s) && (e += " "), e += t.charAt(r), n = !1);
    }
    return "url(" + e + ")";
  }
  const { hasOwnProperty: wn } = Object.prototype, ne = function() {
  };
  function jn(t) {
    return typeof t == "function" ? t : ne;
  }
  function Bn(t, e) {
    return function(n, r, s) {
      n.type === e && t.call(this, n, r, s);
    };
  }
  function Ca(t, e) {
    const n = e.structure, r = [];
    for (const s in n) {
      if (wn.call(n, s) === !1)
        continue;
      let o = n[s];
      const a = {
        name: s,
        type: !1,
        nullable: !1
      };
      Array.isArray(o) || (o = [o]);
      for (const l of o)
        l === null ? a.nullable = !0 : typeof l == "string" ? a.type = "node" : Array.isArray(l) && (a.type = "list");
      a.type && r.push(a);
    }
    return r.length ? {
      context: e.walkContext,
      fields: r
    } : null;
  }
  function wa(t) {
    const e = {};
    for (const n in t.node)
      if (wn.call(t.node, n)) {
        const r = t.node[n];
        if (!r.structure)
          throw new Error("Missed `structure` field in `" + n + "` node type definition");
        e[n] = Ca(n, r);
      }
    return e;
  }
  function Un(t, e) {
    const n = t.fields.slice(), r = t.context, s = typeof r == "string";
    return e && n.reverse(), function(o, a, l, u) {
      let i;
      s && (i = a[r], a[r] = o);
      for (const c of n) {
        const h = o[c.name];
        if (!c.nullable || h) {
          if (c.type === "list") {
            if (e ? h.reduceRight(u, !1) : h.reduce(u, !1))
              return !0;
          } else if (l(h))
            return !0;
        }
      }
      s && (a[r] = i);
    };
  }
  function Wn({
    StyleSheet: t,
    Atrule: e,
    Rule: n,
    Block: r,
    DeclarationList: s
  }) {
    return {
      Atrule: {
        StyleSheet: t,
        Atrule: e,
        Rule: n,
        Block: r
      },
      Rule: {
        StyleSheet: t,
        Atrule: e,
        Rule: n,
        Block: r
      },
      Declaration: {
        StyleSheet: t,
        Atrule: e,
        Rule: n,
        Block: r,
        DeclarationList: s
      }
    };
  }
  function Aa(t) {
    const e = wa(t), n = {}, r = {}, s = Symbol("break-walk"), o = Symbol("skip-node");
    for (const i in e)
      wn.call(e, i) && e[i] !== null && (n[i] = Un(e[i], !1), r[i] = Un(e[i], !0));
    const a = Wn(n), l = Wn(r), u = function(i, c) {
      function h(S, x, T) {
        const M = f.call(k, S, x, T);
        return M === s ? !0 : M === o ? !1 : !!(g.hasOwnProperty(S.type) && g[S.type](S, k, h, m) || p.call(k, S, x, T) === s);
      }
      let f = ne, p = ne, g = n, m = (S, x, T, M) => S || h(x, T, M);
      const k = {
        break: s,
        skip: o,
        root: i,
        stylesheet: null,
        atrule: null,
        atrulePrelude: null,
        rule: null,
        selector: null,
        block: null,
        declaration: null,
        function: null
      };
      if (typeof c == "function")
        f = c;
      else if (c && (f = jn(c.enter), p = jn(c.leave), c.reverse && (g = r), c.visit)) {
        if (a.hasOwnProperty(c.visit))
          g = c.reverse ? l[c.visit] : a[c.visit];
        else if (!e.hasOwnProperty(c.visit))
          throw new Error("Bad value `" + c.visit + "` for `visit` option (should be: " + Object.keys(e).sort().join(", ") + ")");
        f = Bn(f, c.visit), p = Bn(p, c.visit);
      }
      if (f === ne && p === ne)
        throw new Error("Neither `enter` nor `leave` walker handler is set or both aren't a function");
      h(i);
    };
    return u.break = s, u.skip = o, u.find = function(i, c) {
      let h = null;
      return u(i, function(f, p, g) {
        if (c.call(this, f, p, g))
          return h = f, s;
      }), h;
    }, u.findLast = function(i, c) {
      let h = null;
      return u(i, {
        reverse: !0,
        enter(f, p, g) {
          if (c.call(this, f, p, g))
            return h = f, s;
        }
      }), h;
    }, u.findAll = function(i, c) {
      const h = [];
      return u(i, function(f, p, g) {
        c.call(this, f, p, g) && h.push(f);
      }), h;
    }, u;
  }
  const mt = 43, rt = 45, xe = 110, It = !0, Ta = !1;
  function Ce(t, e) {
    let n = this.tokenStart + t;
    const r = this.charCodeAt(n);
    for ((r === mt || r === rt) && (e && this.error("Number sign is not allowed"), n++); n < this.tokenEnd; n++)
      st(this.charCodeAt(n)) || this.error("Integer is expected", n);
  }
  function Ht(t) {
    return Ce.call(this, 0, t);
  }
  function Tt(t, e) {
    if (!this.cmpChar(this.tokenStart + t, e)) {
      let n = "";
      switch (e) {
        case xe:
          n = "N is expected";
          break;
        case rt:
          n = "HyphenMinus is expected";
          break;
      }
      this.error(n, this.tokenStart + t);
    }
  }
  function He() {
    let t = 0, e = 0, n = this.tokenType;
    for (; n === W || n === Y; )
      n = this.lookupType(++t);
    if (n !== b)
      if (this.isDelim(mt, t) || this.isDelim(rt, t)) {
        e = this.isDelim(mt, t) ? mt : rt;
        do
          n = this.lookupType(++t);
        while (n === W || n === Y);
        n !== b && (this.skip(t), Ht.call(this, It));
      } else
        return null;
    return t > 0 && this.skip(t), e === 0 && (n = this.charCodeAt(this.tokenStart), n !== mt && n !== rt && this.error("Number sign is expected")), Ht.call(this, e !== 0), e === rt ? "-" + this.consume(b) : this.consume(b);
  }
  const va = "AnPlusB", Ea = {
    a: [String, null],
    b: [String, null]
  };
  function ns() {
    const t = this.tokenStart;
    let e = null, n = null;
    if (this.tokenType === b)
      Ht.call(this, Ta), n = this.consume(b);
    else if (this.tokenType === d && this.cmpChar(this.tokenStart, rt))
      switch (e = "-1", Tt.call(this, 1, xe), this.tokenEnd - this.tokenStart) {
        // -n
        // -n <signed-integer>
        // -n ['+' | '-'] <signless-integer>
        case 2:
          this.next(), n = He.call(this);
          break;
        // -n- <signless-integer>
        case 3:
          Tt.call(this, 2, rt), this.next(), this.skipSC(), Ht.call(this, It), n = "-" + this.consume(b);
          break;
        // <dashndashdigit-ident>
        default:
          Tt.call(this, 2, rt), Ce.call(this, 3, It), this.next(), n = this.substrToCursor(t + 2);
      }
    else if (this.tokenType === d || this.isDelim(mt) && this.lookupType(1) === d) {
      let r = 0;
      switch (e = "1", this.isDelim(mt) && (r = 1, this.next()), Tt.call(this, 0, xe), this.tokenEnd - this.tokenStart) {
        // '+'? n
        // '+'? n <signed-integer>
        // '+'? n ['+' | '-'] <signless-integer>
        case 1:
          this.next(), n = He.call(this);
          break;
        // '+'? n- <signless-integer>
        case 2:
          Tt.call(this, 1, rt), this.next(), this.skipSC(), Ht.call(this, It), n = "-" + this.consume(b);
          break;
        // '+'? <ndashdigit-ident>
        default:
          Tt.call(this, 1, rt), Ce.call(this, 2, It), this.next(), n = this.substrToCursor(t + r + 1);
      }
    } else if (this.tokenType === E) {
      const r = this.charCodeAt(this.tokenStart), s = r === mt || r === rt;
      let o = this.tokenStart + s;
      for (; o < this.tokenEnd && st(this.charCodeAt(o)); o++)
        ;
      o === this.tokenStart + s && this.error("Integer is expected", this.tokenStart + s), Tt.call(this, o - this.tokenStart, xe), e = this.substring(t, o), o + 1 === this.tokenEnd ? (this.next(), n = He.call(this)) : (Tt.call(this, o - this.tokenStart + 1, rt), o + 2 === this.tokenEnd ? (this.next(), this.skipSC(), Ht.call(this, It), n = "-" + this.consume(b)) : (Ce.call(this, o - this.tokenStart + 2, It), this.next(), n = this.substrToCursor(o + 1)));
    } else
      this.error();
    return e !== null && e.charCodeAt(0) === mt && (e = e.substr(1)), n !== null && n.charCodeAt(0) === mt && (n = n.substr(1)), {
      type: "AnPlusB",
      loc: this.getLocation(t, this.tokenStart),
      a: e,
      b: n
    };
  }
  function rs(t) {
    if (t.a) {
      const e = t.a === "+1" && "n" || t.a === "1" && "n" || t.a === "-1" && "-n" || t.a + "n";
      if (t.b) {
        const n = t.b[0] === "-" || t.b[0] === "+" ? t.b : "+" + t.b;
        this.tokenize(e + n);
      } else
        this.tokenize(e);
    } else
      this.tokenize(t.b);
  }
  const $a = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: rs,
    name: va,
    parse: ns,
    structure: Ea
  }, Symbol.toStringTag, { value: "Module" }));
  function zn() {
    return this.Raw(this.consumeUntilLeftCurlyBracketOrSemicolon, !0);
  }
  function Oa() {
    for (let t = 1, e; e = this.lookupType(t); t++) {
      if (e === Yt)
        return !0;
      if (e === ht || e === z)
        return !1;
    }
    return !1;
  }
  const La = "Atrule", Pa = "atrule", Ra = {
    name: String,
    prelude: ["AtrulePrelude", "Raw", null],
    block: ["Block", null]
  };
  function ss(t = !1) {
    const e = this.tokenStart;
    let n, r, s = null, o = null;
    switch (this.eat(z), n = this.substrToCursor(e + 1), r = n.toLowerCase(), this.skipSC(), this.eof === !1 && this.tokenType !== ht && this.tokenType !== tt && (this.parseAtrulePrelude ? s = this.parseWithFallback(this.AtrulePrelude.bind(this, n, t), zn) : s = zn.call(this, this.tokenIndex), this.skipSC()), this.tokenType) {
      case tt:
        this.next();
        break;
      case ht:
        hasOwnProperty.call(this.atrule, r) && typeof this.atrule[r].block == "function" ? o = this.atrule[r].block.call(this, t) : o = this.Block(Oa.call(this));
        break;
    }
    return {
      type: "Atrule",
      loc: this.getLocation(e, this.tokenStart),
      name: n,
      prelude: s,
      block: o
    };
  }
  function is(t) {
    this.token(z, "@" + t.name), t.prelude !== null && this.node(t.prelude), t.block ? this.node(t.block) : this.token(tt, ";");
  }
  const Ia = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: is,
    name: La,
    parse: ss,
    structure: Ra,
    walkContext: Pa
  }, Symbol.toStringTag, { value: "Module" })), _a = "AtrulePrelude", Na = "atrulePrelude", Da = {
    children: [[]]
  };
  function os(t) {
    let e = null;
    return t !== null && (t = t.toLowerCase()), this.skipSC(), hasOwnProperty.call(this.atrule, t) && typeof this.atrule[t].prelude == "function" ? e = this.atrule[t].prelude.call(this) : e = this.readSequence(this.scope.AtrulePrelude), this.skipSC(), this.eof !== !0 && this.tokenType !== ht && this.tokenType !== tt && this.error("Semicolon or block is expected"), {
      type: "AtrulePrelude",
      loc: this.getLocationFromList(e),
      children: e
    };
  }
  function as(t) {
    this.children(t);
  }
  const Fa = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: as,
    name: _a,
    parse: os,
    structure: Da,
    walkContext: Na
  }, Symbol.toStringTag, { value: "Module" })), Ma = 36, ls = 42, we = 61, ja = 94, hn = 124, Ba = 126;
  function Ua() {
    this.eof && this.error("Unexpected end of input");
    const t = this.tokenStart;
    let e = !1;
    return this.isDelim(ls) ? (e = !0, this.next()) : this.isDelim(hn) || this.eat(d), this.isDelim(hn) ? this.charCodeAt(this.tokenStart + 1) !== we ? (this.next(), this.eat(d)) : e && this.error("Identifier is expected", this.tokenEnd) : e && this.error("Vertical line is expected"), {
      type: "Identifier",
      loc: this.getLocation(t, this.tokenStart),
      name: this.substrToCursor(t)
    };
  }
  function Wa() {
    const t = this.tokenStart, e = this.charCodeAt(t);
    return e !== we && // =
    e !== Ba && // ~=
    e !== ja && // ^=
    e !== Ma && // $=
    e !== ls && // *=
    e !== hn && this.error("Attribute selector (=, ~=, ^=, $=, *=, |=) is expected"), this.next(), e !== we && (this.isDelim(we) || this.error("Equal sign is expected"), this.next()), this.substrToCursor(t);
  }
  const za = "AttributeSelector", Ha = {
    name: "Identifier",
    matcher: [String, null],
    value: ["String", "Identifier", null],
    flags: [String, null]
  };
  function cs() {
    const t = this.tokenStart;
    let e, n = null, r = null, s = null;
    return this.eat(ee), this.skipSC(), e = Ua.call(this), this.skipSC(), this.tokenType !== ce && (this.tokenType !== d && (n = Wa.call(this), this.skipSC(), r = this.tokenType === At ? this.String() : this.Identifier(), this.skipSC()), this.tokenType === d && (s = this.consume(d), this.skipSC())), this.eat(ce), {
      type: "AttributeSelector",
      loc: this.getLocation(t, this.tokenStart),
      name: e,
      matcher: n,
      value: r,
      flags: s
    };
  }
  function us(t) {
    this.token(O, "["), this.node(t.name), t.matcher !== null && (this.tokenize(t.matcher), this.node(t.value)), t.flags !== null && this.token(d, t.flags), this.token(O, "]");
  }
  const Va = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: us,
    name: za,
    parse: cs,
    structure: Ha
  }, Symbol.toStringTag, { value: "Module" })), Ga = 38;
  function hs() {
    return this.Raw(null, !0);
  }
  function Hn() {
    return this.parseWithFallback(this.Rule, hs);
  }
  function Vn() {
    return this.Raw(this.consumeUntilSemicolonIncluded, !0);
  }
  function qa() {
    if (this.tokenType === tt)
      return Vn.call(this, this.tokenIndex);
    const t = this.parseWithFallback(this.Declaration, Vn);
    return this.tokenType === tt && this.next(), t;
  }
  const Ka = "Block", Qa = "block", Ya = {
    children: [[
      "Atrule",
      "Rule",
      "Declaration"
    ]]
  };
  function fs(t) {
    const e = t ? qa : Hn, n = this.tokenStart;
    let r = this.createList();
    this.eat(ht);
    t:
      for (; !this.eof; )
        switch (this.tokenType) {
          case Yt:
            break t;
          case W:
          case Y:
            this.next();
            break;
          case z:
            r.push(this.parseWithFallback(this.Atrule.bind(this, t), hs));
            break;
          default:
            t && this.isDelim(Ga) ? r.push(Hn.call(this)) : r.push(e.call(this));
        }
    return this.eof || this.eat(Yt), {
      type: "Block",
      loc: this.getLocation(n, this.tokenStart),
      children: r
    };
  }
  function ps(t) {
    this.token(ht, "{"), this.children(t, (e) => {
      e.type === "Declaration" && this.token(tt, ";");
    }), this.token(Yt, "}");
  }
  const Xa = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ps,
    name: Ka,
    parse: fs,
    structure: Ya,
    walkContext: Qa
  }, Symbol.toStringTag, { value: "Module" })), Ja = "Brackets", Za = {
    children: [[]]
  };
  function ds(t, e) {
    const n = this.tokenStart;
    let r = null;
    return this.eat(ee), r = t.call(this, e), this.eof || this.eat(ce), {
      type: "Brackets",
      loc: this.getLocation(n, this.tokenStart),
      children: r
    };
  }
  function gs(t) {
    this.token(O, "["), this.children(t), this.token(O, "]");
  }
  const tl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: gs,
    name: Ja,
    parse: ds,
    structure: Za
  }, Symbol.toStringTag, { value: "Module" })), el = "CDC", nl = [];
  function ms() {
    const t = this.tokenStart;
    return this.eat(nt), {
      type: "CDC",
      loc: this.getLocation(t, this.tokenStart)
    };
  }
  function ks() {
    this.token(nt, "-->");
  }
  const rl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ks,
    name: el,
    parse: ms,
    structure: nl
  }, Symbol.toStringTag, { value: "Module" })), sl = "CDO", il = [];
  function Ss() {
    const t = this.tokenStart;
    return this.eat(Fe), {
      type: "CDO",
      loc: this.getLocation(t, this.tokenStart)
    };
  }
  function ys() {
    this.token(Fe, "<!--");
  }
  const ol = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ys,
    name: sl,
    parse: Ss,
    structure: il
  }, Symbol.toStringTag, { value: "Module" })), al = 46, ll = "ClassSelector", cl = {
    name: String
  };
  function bs() {
    return this.eatDelim(al), {
      type: "ClassSelector",
      loc: this.getLocation(this.tokenStart - 1, this.tokenEnd),
      name: this.consume(d)
    };
  }
  function xs(t) {
    this.token(O, "."), this.token(d, t.name);
  }
  const ul = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: xs,
    name: ll,
    parse: bs,
    structure: cl
  }, Symbol.toStringTag, { value: "Module" })), hl = 43, Gn = 47, fl = 62, pl = 126, dl = "Combinator", gl = {
    name: String
  };
  function Cs() {
    const t = this.tokenStart;
    let e;
    switch (this.tokenType) {
      case W:
        e = " ";
        break;
      case O:
        switch (this.charCodeAt(this.tokenStart)) {
          case fl:
          case hl:
          case pl:
            this.next();
            break;
          case Gn:
            this.next(), this.eatIdent("deep"), this.eatDelim(Gn);
            break;
          default:
            this.error("Combinator is expected");
        }
        e = this.substrToCursor(t);
        break;
    }
    return {
      type: "Combinator",
      loc: this.getLocation(t, this.tokenStart),
      name: e
    };
  }
  function ws(t) {
    this.tokenize(t.name);
  }
  const ml = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ws,
    name: dl,
    parse: Cs,
    structure: gl
  }, Symbol.toStringTag, { value: "Module" })), kl = 42, Sl = 47, yl = "Comment", bl = {
    value: String
  };
  function As() {
    const t = this.tokenStart;
    let e = this.tokenEnd;
    return this.eat(Y), e - t + 2 >= 2 && this.charCodeAt(e - 2) === kl && this.charCodeAt(e - 1) === Sl && (e -= 2), {
      type: "Comment",
      loc: this.getLocation(t, this.tokenStart),
      value: this.substring(t + 2, e)
    };
  }
  function Ts(t) {
    this.token(Y, "/*" + t.value + "*/");
  }
  const xl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ts,
    name: yl,
    parse: As,
    structure: bl
  }, Symbol.toStringTag, { value: "Module" })), Cl = /* @__PURE__ */ new Set([X, y, vt]), wl = "Condition", Al = {
    kind: String,
    children: [[
      "Identifier",
      "Feature",
      "FeatureFunction",
      "FeatureRange",
      "SupportsDeclaration"
    ]]
  };
  function qn(t) {
    return this.lookupTypeNonSC(1) === d && Cl.has(this.lookupTypeNonSC(2)) ? this.Feature(t) : this.FeatureRange(t);
  }
  const Tl = {
    media: qn,
    container: qn,
    supports() {
      return this.SupportsDeclaration();
    }
  };
  function vs(t = "media") {
    const e = this.createList();
    t: for (; !this.eof; )
      switch (this.tokenType) {
        case Y:
        case W:
          this.next();
          continue;
        case d:
          e.push(this.Identifier());
          break;
        case I: {
          let n = this.parseWithFallback(
            () => Tl[t].call(this, t),
            () => null
          );
          n || (n = this.parseWithFallback(
            () => {
              this.eat(I);
              const r = this.Condition(t);
              return this.eat(y), r;
            },
            () => this.GeneralEnclosed(t)
          )), e.push(n);
          break;
        }
        case A: {
          let n = this.parseWithFallback(
            () => this.FeatureFunction(t),
            () => null
          );
          n || (n = this.GeneralEnclosed(t)), e.push(n);
          break;
        }
        default:
          break t;
      }
    return e.isEmpty && this.error("Condition is expected"), {
      type: "Condition",
      loc: this.getLocationFromList(e),
      kind: t,
      children: e
    };
  }
  function Es(t) {
    t.children.forEach((e) => {
      e.type === "Condition" ? (this.token(I, "("), this.node(e), this.token(y, ")")) : this.node(e);
    });
  }
  const vl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Es,
    name: wl,
    parse: vs,
    structure: Al
  }, Symbol.toStringTag, { value: "Module" })), $s = 33, El = 35, $l = 36, Ol = 38, Ll = 42, Pl = 43, Kn = 47;
  function Rl() {
    return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !0);
  }
  function Il() {
    return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !1);
  }
  function _l() {
    const t = this.tokenIndex, e = this.Value();
    return e.type !== "Raw" && this.eof === !1 && this.tokenType !== tt && this.isDelim($s) === !1 && this.isBalanceEdge(t) === !1 && this.error(), e;
  }
  const Nl = "Declaration", Dl = "declaration", Fl = {
    important: [Boolean, String],
    property: String,
    value: ["Value", "Raw"]
  };
  function Os() {
    const t = this.tokenStart, e = this.tokenIndex, n = Ml.call(this), r = pa(n), s = r ? this.parseCustomProperty : this.parseValue, o = r ? Il : Rl;
    let a = !1, l;
    this.skipSC(), this.eat(X);
    const u = this.tokenIndex;
    if (r || this.skipSC(), s ? l = this.parseWithFallback(_l, o) : l = o.call(this, this.tokenIndex), r && l.type === "Value" && l.children.isEmpty) {
      for (let i = u - this.tokenIndex; i <= 0; i++)
        if (this.lookupType(i) === W) {
          l.children.appendData({
            type: "WhiteSpace",
            loc: null,
            value: " "
          });
          break;
        }
    }
    return this.isDelim($s) && (a = jl.call(this), this.skipSC()), this.eof === !1 && this.tokenType !== tt && this.isBalanceEdge(e) === !1 && this.error(), {
      type: "Declaration",
      loc: this.getLocation(t, this.tokenStart),
      important: a,
      property: n,
      value: l
    };
  }
  function Ls(t) {
    this.token(d, t.property), this.token(X, ":"), this.node(t.value), t.important && (this.token(O, "!"), this.token(d, t.important === !0 ? "important" : t.important));
  }
  function Ml() {
    const t = this.tokenStart;
    if (this.tokenType === O)
      switch (this.charCodeAt(this.tokenStart)) {
        case Ll:
        case $l:
        case Pl:
        case El:
        case Ol:
          this.next();
          break;
        // TODO: not sure we should support this hack
        case Kn:
          this.next(), this.isDelim(Kn) && this.next();
          break;
      }
    return this.tokenType === _ ? this.eat(_) : this.eat(d), this.substrToCursor(t);
  }
  function jl() {
    this.eat(O), this.skipSC();
    const t = this.consume(d);
    return t === "important" ? !0 : t;
  }
  const Bl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ls,
    name: Nl,
    parse: Os,
    structure: Fl,
    walkContext: Dl
  }, Symbol.toStringTag, { value: "Module" })), Ul = 38;
  function Ve() {
    return this.Raw(this.consumeUntilSemicolonIncluded, !0);
  }
  const Wl = "DeclarationList", zl = {
    children: [[
      "Declaration",
      "Atrule",
      "Rule"
    ]]
  };
  function Ps() {
    const t = this.createList();
    for (; !this.eof; )
      switch (this.tokenType) {
        case W:
        case Y:
        case tt:
          this.next();
          break;
        case z:
          t.push(this.parseWithFallback(this.Atrule.bind(this, !0), Ve));
          break;
        default:
          this.isDelim(Ul) ? t.push(this.parseWithFallback(this.Rule, Ve)) : t.push(this.parseWithFallback(this.Declaration, Ve));
      }
    return {
      type: "DeclarationList",
      loc: this.getLocationFromList(t),
      children: t
    };
  }
  function Rs(t) {
    this.children(t, (e) => {
      e.type === "Declaration" && this.token(tt, ";");
    });
  }
  const Hl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Rs,
    name: Wl,
    parse: Ps,
    structure: zl
  }, Symbol.toStringTag, { value: "Module" })), Vl = "Dimension", Gl = {
    value: String,
    unit: String
  };
  function Is() {
    const t = this.tokenStart, e = this.consumeNumber(E);
    return {
      type: "Dimension",
      loc: this.getLocation(t, this.tokenStart),
      value: e,
      unit: this.substring(t + e.length, this.tokenStart)
    };
  }
  function _s(t) {
    this.token(E, t.value + t.unit);
  }
  const ql = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: _s,
    name: Vl,
    parse: Is,
    structure: Gl
  }, Symbol.toStringTag, { value: "Module" })), Kl = 47, Ql = "Feature", Yl = {
    kind: String,
    name: String,
    value: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
  };
  function Ns(t) {
    const e = this.tokenStart;
    let n, r = null;
    if (this.eat(I), this.skipSC(), n = this.consume(d), this.skipSC(), this.tokenType !== y) {
      switch (this.eat(X), this.skipSC(), this.tokenType) {
        case b:
          this.lookupNonWSType(1) === O ? r = this.Ratio() : r = this.Number();
          break;
        case E:
          r = this.Dimension();
          break;
        case d:
          r = this.Identifier();
          break;
        case A:
          r = this.parseWithFallback(
            () => {
              const s = this.Function(this.readSequence, this.scope.Value);
              return this.skipSC(), this.isDelim(Kl) && this.error(), s;
            },
            () => this.Ratio()
          );
          break;
        default:
          this.error("Number, dimension, ratio or identifier is expected");
      }
      this.skipSC();
    }
    return this.eof || this.eat(y), {
      type: "Feature",
      loc: this.getLocation(e, this.tokenStart),
      kind: t,
      name: n,
      value: r
    };
  }
  function Ds(t) {
    this.token(I, "("), this.token(d, t.name), t.value !== null && (this.token(X, ":"), this.node(t.value)), this.token(y, ")");
  }
  const Xl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ds,
    name: Ql,
    parse: Ns,
    structure: Yl
  }, Symbol.toStringTag, { value: "Module" })), Jl = "FeatureFunction", Zl = {
    kind: String,
    feature: String,
    value: ["Declaration", "Selector"]
  };
  function tc(t, e) {
    const r = (this.features[t] || {})[e];
    return typeof r != "function" && this.error(`Unknown feature ${e}()`), r;
  }
  function Fs(t = "unknown") {
    const e = this.tokenStart, n = this.consumeFunctionName(), r = tc.call(this, t, n.toLowerCase());
    this.skipSC();
    const s = this.parseWithFallback(
      () => {
        const o = this.tokenIndex, a = r.call(this);
        return this.eof === !1 && this.isBalanceEdge(o) === !1 && this.error(), a;
      },
      () => this.Raw(null, !1)
    );
    return this.eof || this.eat(y), {
      type: "FeatureFunction",
      loc: this.getLocation(e, this.tokenStart),
      kind: t,
      feature: n,
      value: s
    };
  }
  function Ms(t) {
    this.token(A, t.feature + "("), this.node(t.value), this.token(y, ")");
  }
  const ec = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ms,
    name: Jl,
    parse: Fs,
    structure: Zl
  }, Symbol.toStringTag, { value: "Module" })), Qn = 47, nc = 60, Yn = 61, rc = 62, sc = "FeatureRange", ic = {
    kind: String,
    left: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
    leftComparison: String,
    middle: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
    rightComparison: [String, null],
    right: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
  };
  function Ge() {
    switch (this.skipSC(), this.tokenType) {
      case b:
        return this.isDelim(Qn, this.lookupOffsetNonSC(1)) ? this.Ratio() : this.Number();
      case E:
        return this.Dimension();
      case d:
        return this.Identifier();
      case A:
        return this.parseWithFallback(
          () => {
            const t = this.Function(this.readSequence, this.scope.Value);
            return this.skipSC(), this.isDelim(Qn) && this.error(), t;
          },
          () => this.Ratio()
        );
      default:
        this.error("Number, dimension, ratio or identifier is expected");
    }
  }
  function Xn(t) {
    if (this.skipSC(), this.isDelim(nc) || this.isDelim(rc)) {
      const e = this.source[this.tokenStart];
      return this.next(), this.isDelim(Yn) ? (this.next(), e + "=") : e;
    }
    if (this.isDelim(Yn))
      return "=";
    this.error(`Expected ${t ? '":", ' : ""}"<", ">", "=" or ")"`);
  }
  function js(t = "unknown") {
    const e = this.tokenStart;
    this.skipSC(), this.eat(I);
    const n = Ge.call(this), r = Xn.call(this, n.type === "Identifier"), s = Ge.call(this);
    let o = null, a = null;
    return this.lookupNonWSType(0) !== y && (o = Xn.call(this), a = Ge.call(this)), this.skipSC(), this.eat(y), {
      type: "FeatureRange",
      loc: this.getLocation(e, this.tokenStart),
      kind: t,
      left: n,
      leftComparison: r,
      middle: s,
      rightComparison: o,
      right: a
    };
  }
  function Bs(t) {
    this.token(I, "("), this.node(t.left), this.tokenize(t.leftComparison), this.node(t.middle), t.right && (this.tokenize(t.rightComparison), this.node(t.right)), this.token(y, ")");
  }
  const oc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Bs,
    name: sc,
    parse: js,
    structure: ic
  }, Symbol.toStringTag, { value: "Module" })), ac = "Function", lc = "function", cc = {
    name: String,
    children: [[]]
  };
  function Us(t, e) {
    const n = this.tokenStart, r = this.consumeFunctionName(), s = r.toLowerCase();
    let o;
    return o = e.hasOwnProperty(s) ? e[s].call(this, e) : t.call(this, e), this.eof || this.eat(y), {
      type: "Function",
      loc: this.getLocation(n, this.tokenStart),
      name: r,
      children: o
    };
  }
  function Ws(t) {
    this.token(A, t.name + "("), this.children(t), this.token(y, ")");
  }
  const uc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ws,
    name: ac,
    parse: Us,
    structure: cc,
    walkContext: lc
  }, Symbol.toStringTag, { value: "Module" })), hc = "GeneralEnclosed", fc = {
    kind: String,
    function: [String, null],
    children: [[]]
  };
  function zs(t) {
    const e = this.tokenStart;
    let n = null;
    this.tokenType === A ? n = this.consumeFunctionName() : this.eat(I);
    const r = this.parseWithFallback(
      () => {
        const s = this.tokenIndex, o = this.readSequence(this.scope.Value);
        return this.eof === !1 && this.isBalanceEdge(s) === !1 && this.error(), o;
      },
      () => this.createSingleNodeList(
        this.Raw(null, !1)
      )
    );
    return this.eof || this.eat(y), {
      type: "GeneralEnclosed",
      loc: this.getLocation(e, this.tokenStart),
      kind: t,
      function: n,
      children: r
    };
  }
  function Hs(t) {
    t.function ? this.token(A, t.function + "(") : this.token(I, "("), this.children(t), this.token(y, ")");
  }
  const pc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Hs,
    name: hc,
    parse: zs,
    structure: fc
  }, Symbol.toStringTag, { value: "Module" })), dc = "XXX", gc = "Hash", mc = {
    value: String
  };
  function Vs() {
    const t = this.tokenStart;
    return this.eat(_), {
      type: "Hash",
      loc: this.getLocation(t, this.tokenStart),
      value: this.substrToCursor(t + 1)
    };
  }
  function Gs(t) {
    this.token(_, "#" + t.value);
  }
  const kc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Gs,
    name: gc,
    parse: Vs,
    structure: mc,
    xxx: dc
  }, Symbol.toStringTag, { value: "Module" })), Sc = "Identifier", yc = {
    name: String
  };
  function qs() {
    return {
      type: "Identifier",
      loc: this.getLocation(this.tokenStart, this.tokenEnd),
      name: this.consume(d)
    };
  }
  function Ks(t) {
    this.token(d, t.name);
  }
  const bc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ks,
    name: Sc,
    parse: qs,
    structure: yc
  }, Symbol.toStringTag, { value: "Module" })), xc = "IdSelector", Cc = {
    name: String
  };
  function Qs() {
    const t = this.tokenStart;
    return this.eat(_), {
      type: "IdSelector",
      loc: this.getLocation(t, this.tokenStart),
      name: this.substrToCursor(t + 1)
    };
  }
  function Ys(t) {
    this.token(O, "#" + t.name);
  }
  const wc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ys,
    name: xc,
    parse: Qs,
    structure: Cc
  }, Symbol.toStringTag, { value: "Module" })), Ac = 46, Tc = "Layer", vc = {
    name: String
  };
  function Xs() {
    let t = this.tokenStart, e = this.consume(d);
    for (; this.isDelim(Ac); )
      this.eat(O), e += "." + this.consume(d);
    return {
      type: "Layer",
      loc: this.getLocation(t, this.tokenStart),
      name: e
    };
  }
  function Js(t) {
    this.tokenize(t.name);
  }
  const Ec = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Js,
    name: Tc,
    parse: Xs,
    structure: vc
  }, Symbol.toStringTag, { value: "Module" })), $c = "LayerList", Oc = {
    children: [[
      "Layer"
    ]]
  };
  function Zs() {
    const t = this.createList();
    for (this.skipSC(); !this.eof && (t.push(this.Layer()), this.lookupTypeNonSC(0) === ft); )
      this.skipSC(), this.next(), this.skipSC();
    return {
      type: "LayerList",
      loc: this.getLocationFromList(t),
      children: t
    };
  }
  function ti(t) {
    this.children(t, () => this.token(ft, ","));
  }
  const Lc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ti,
    name: $c,
    parse: Zs,
    structure: Oc
  }, Symbol.toStringTag, { value: "Module" })), Pc = "MediaQuery", Rc = {
    modifier: [String, null],
    mediaType: [String, null],
    condition: ["Condition", null]
  };
  function ei() {
    const t = this.tokenStart;
    let e = null, n = null, r = null;
    if (this.skipSC(), this.tokenType === d && this.lookupTypeNonSC(1) !== I) {
      const s = this.consume(d), o = s.toLowerCase();
      switch (o === "not" || o === "only" ? (this.skipSC(), e = o, n = this.consume(d)) : n = s, this.lookupTypeNonSC(0)) {
        case d: {
          this.skipSC(), this.eatIdent("and"), r = this.Condition("media");
          break;
        }
        case ht:
        case tt:
        case ft:
        case vt:
          break;
        default:
          this.error("Identifier or parenthesis is expected");
      }
    } else
      switch (this.tokenType) {
        case d:
        case I:
        case A: {
          r = this.Condition("media");
          break;
        }
        case ht:
        case tt:
        case vt:
          break;
        default:
          this.error("Identifier or parenthesis is expected");
      }
    return {
      type: "MediaQuery",
      loc: this.getLocation(t, this.tokenStart),
      modifier: e,
      mediaType: n,
      condition: r
    };
  }
  function ni(t) {
    t.mediaType ? (t.modifier && this.token(d, t.modifier), this.token(d, t.mediaType), t.condition && (this.token(d, "and"), this.node(t.condition))) : t.condition && this.node(t.condition);
  }
  const Ic = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ni,
    name: Pc,
    parse: ei,
    structure: Rc
  }, Symbol.toStringTag, { value: "Module" })), _c = "MediaQueryList", Nc = {
    children: [[
      "MediaQuery"
    ]]
  };
  function ri() {
    const t = this.createList();
    for (this.skipSC(); !this.eof && (t.push(this.MediaQuery()), this.tokenType === ft); )
      this.next();
    return {
      type: "MediaQueryList",
      loc: this.getLocationFromList(t),
      children: t
    };
  }
  function si(t) {
    this.children(t, () => this.token(ft, ","));
  }
  const Dc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: si,
    name: _c,
    parse: ri,
    structure: Nc
  }, Symbol.toStringTag, { value: "Module" })), Fc = 38, Mc = "NestingSelector", jc = {};
  function ii() {
    const t = this.tokenStart;
    return this.eatDelim(Fc), {
      type: "NestingSelector",
      loc: this.getLocation(t, this.tokenStart)
    };
  }
  function oi() {
    this.token(O, "&");
  }
  const Bc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: oi,
    name: Mc,
    parse: ii,
    structure: jc
  }, Symbol.toStringTag, { value: "Module" })), Uc = "Nth", Wc = {
    nth: ["AnPlusB", "Identifier"],
    selector: ["SelectorList", null]
  };
  function ai() {
    this.skipSC();
    const t = this.tokenStart;
    let e = t, n = null, r;
    return this.lookupValue(0, "odd") || this.lookupValue(0, "even") ? r = this.Identifier() : r = this.AnPlusB(), e = this.tokenStart, this.skipSC(), this.lookupValue(0, "of") && (this.next(), n = this.SelectorList(), e = this.tokenStart), {
      type: "Nth",
      loc: this.getLocation(t, e),
      nth: r,
      selector: n
    };
  }
  function li(t) {
    this.node(t.nth), t.selector !== null && (this.token(d, "of"), this.node(t.selector));
  }
  const zc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: li,
    name: Uc,
    parse: ai,
    structure: Wc
  }, Symbol.toStringTag, { value: "Module" })), Hc = "Number", Vc = {
    value: String
  };
  function ci() {
    return {
      type: "Number",
      loc: this.getLocation(this.tokenStart, this.tokenEnd),
      value: this.consume(b)
    };
  }
  function ui(t) {
    this.token(b, t.value);
  }
  const Gc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: ui,
    name: Hc,
    parse: ci,
    structure: Vc
  }, Symbol.toStringTag, { value: "Module" })), qc = "Operator", Kc = {
    value: String
  };
  function hi() {
    const t = this.tokenStart;
    return this.next(), {
      type: "Operator",
      loc: this.getLocation(t, this.tokenStart),
      value: this.substrToCursor(t)
    };
  }
  function fi(t) {
    this.tokenize(t.value);
  }
  const Qc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: fi,
    name: qc,
    parse: hi,
    structure: Kc
  }, Symbol.toStringTag, { value: "Module" })), Yc = "Parentheses", Xc = {
    children: [[]]
  };
  function pi(t, e) {
    const n = this.tokenStart;
    let r = null;
    return this.eat(I), r = t.call(this, e), this.eof || this.eat(y), {
      type: "Parentheses",
      loc: this.getLocation(n, this.tokenStart),
      children: r
    };
  }
  function di(t) {
    this.token(I, "("), this.children(t), this.token(y, ")");
  }
  const Jc = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: di,
    name: Yc,
    parse: pi,
    structure: Xc
  }, Symbol.toStringTag, { value: "Module" })), Zc = "Percentage", tu = {
    value: String
  };
  function gi() {
    return {
      type: "Percentage",
      loc: this.getLocation(this.tokenStart, this.tokenEnd),
      value: this.consumeNumber(F)
    };
  }
  function mi(t) {
    this.token(F, t.value + "%");
  }
  const eu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: mi,
    name: Zc,
    parse: gi,
    structure: tu
  }, Symbol.toStringTag, { value: "Module" })), nu = "PseudoClassSelector", ru = "function", su = {
    name: String,
    children: [["Raw"], null]
  };
  function ki() {
    const t = this.tokenStart;
    let e = null, n, r;
    return this.eat(X), this.tokenType === A ? (n = this.consumeFunctionName(), r = n.toLowerCase(), this.lookupNonWSType(0) == y ? e = this.createList() : hasOwnProperty.call(this.pseudo, r) ? (this.skipSC(), e = this.pseudo[r].call(this), this.skipSC()) : (e = this.createList(), e.push(
      this.Raw(null, !1)
    )), this.eat(y)) : n = this.consume(d), {
      type: "PseudoClassSelector",
      loc: this.getLocation(t, this.tokenStart),
      name: n,
      children: e
    };
  }
  function Si(t) {
    this.token(X, ":"), t.children === null ? this.token(d, t.name) : (this.token(A, t.name + "("), this.children(t), this.token(y, ")"));
  }
  const iu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Si,
    name: nu,
    parse: ki,
    structure: su,
    walkContext: ru
  }, Symbol.toStringTag, { value: "Module" })), ou = "PseudoElementSelector", au = "function", lu = {
    name: String,
    children: [["Raw"], null]
  };
  function yi() {
    const t = this.tokenStart;
    let e = null, n, r;
    return this.eat(X), this.eat(X), this.tokenType === A ? (n = this.consumeFunctionName(), r = n.toLowerCase(), this.lookupNonWSType(0) == y ? e = this.createList() : hasOwnProperty.call(this.pseudo, r) ? (this.skipSC(), e = this.pseudo[r].call(this), this.skipSC()) : (e = this.createList(), e.push(
      this.Raw(null, !1)
    )), this.eat(y)) : n = this.consume(d), {
      type: "PseudoElementSelector",
      loc: this.getLocation(t, this.tokenStart),
      name: n,
      children: e
    };
  }
  function bi(t) {
    this.token(X, ":"), this.token(X, ":"), t.children === null ? this.token(d, t.name) : (this.token(A, t.name + "("), this.children(t), this.token(y, ")"));
  }
  const cu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: bi,
    name: ou,
    parse: yi,
    structure: lu,
    walkContext: au
  }, Symbol.toStringTag, { value: "Module" })), Jn = 47;
  function Zn() {
    switch (this.skipSC(), this.tokenType) {
      case b:
        return this.Number();
      case A:
        return this.Function(this.readSequence, this.scope.Value);
      default:
        this.error("Number of function is expected");
    }
  }
  const uu = "Ratio", hu = {
    left: ["Number", "Function"],
    right: ["Number", "Function", null]
  };
  function xi() {
    const t = this.tokenStart, e = Zn.call(this);
    let n = null;
    return this.skipSC(), this.isDelim(Jn) && (this.eatDelim(Jn), n = Zn.call(this)), {
      type: "Ratio",
      loc: this.getLocation(t, this.tokenStart),
      left: e,
      right: n
    };
  }
  function Ci(t) {
    this.node(t.left), this.token(O, "/"), t.right ? this.node(t.right) : this.node(b, 1);
  }
  const fu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ci,
    name: uu,
    parse: xi,
    structure: hu
  }, Symbol.toStringTag, { value: "Module" }));
  function pu() {
    return this.tokenIndex > 0 && this.lookupType(-1) === W ? this.tokenIndex > 1 ? this.getTokenStart(this.tokenIndex - 1) : this.firstCharOffset : this.tokenStart;
  }
  const du = "Raw", gu = {
    value: String
  };
  function wi(t, e) {
    const n = this.getTokenStart(this.tokenIndex);
    let r;
    return this.skipUntilBalanced(this.tokenIndex, t || this.consumeUntilBalanceEnd), e && this.tokenStart > n ? r = pu.call(this) : r = this.tokenStart, {
      type: "Raw",
      loc: this.getLocation(n, r),
      value: this.substring(n, r)
    };
  }
  function Ai(t) {
    this.tokenize(t.value);
  }
  const mu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ai,
    name: du,
    parse: wi,
    structure: gu
  }, Symbol.toStringTag, { value: "Module" }));
  function tr() {
    return this.Raw(this.consumeUntilLeftCurlyBracket, !0);
  }
  function ku() {
    const t = this.SelectorList();
    return t.type !== "Raw" && this.eof === !1 && this.tokenType !== ht && this.error(), t;
  }
  const Su = "Rule", yu = "rule", bu = {
    prelude: ["SelectorList", "Raw"],
    block: ["Block"]
  };
  function Ti() {
    const t = this.tokenIndex, e = this.tokenStart;
    let n, r;
    return this.parseRulePrelude ? n = this.parseWithFallback(ku, tr) : n = tr.call(this, t), r = this.Block(!0), {
      type: "Rule",
      loc: this.getLocation(e, this.tokenStart),
      prelude: n,
      block: r
    };
  }
  function vi(t) {
    this.node(t.prelude), this.node(t.block);
  }
  const xu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: vi,
    name: Su,
    parse: Ti,
    structure: bu,
    walkContext: yu
  }, Symbol.toStringTag, { value: "Module" })), Cu = "Scope", wu = {
    root: ["SelectorList", "Raw", null],
    limit: ["SelectorList", "Raw", null]
  };
  function Ei() {
    let t = null, e = null;
    this.skipSC();
    const n = this.tokenStart;
    return this.tokenType === I && (this.next(), this.skipSC(), t = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(!1, !0)
    ), this.skipSC(), this.eat(y)), this.lookupNonWSType(0) === d && (this.skipSC(), this.eatIdent("to"), this.skipSC(), this.eat(I), this.skipSC(), e = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(!1, !0)
    ), this.skipSC(), this.eat(y)), {
      type: "Scope",
      loc: this.getLocation(n, this.tokenStart),
      root: t,
      limit: e
    };
  }
  function $i(t) {
    t.root && (this.token(I, "("), this.node(t.root), this.token(y, ")")), t.limit && (this.token(d, "to"), this.token(I, "("), this.node(t.limit), this.token(y, ")"));
  }
  const Au = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: $i,
    name: Cu,
    parse: Ei,
    structure: wu
  }, Symbol.toStringTag, { value: "Module" })), Tu = "Selector", vu = {
    children: [[
      "TypeSelector",
      "IdSelector",
      "ClassSelector",
      "AttributeSelector",
      "PseudoClassSelector",
      "PseudoElementSelector",
      "Combinator"
    ]]
  };
  function Oi() {
    const t = this.readSequence(this.scope.Selector);
    return this.getFirstListNode(t) === null && this.error("Selector is expected"), {
      type: "Selector",
      loc: this.getLocationFromList(t),
      children: t
    };
  }
  function Li(t) {
    this.children(t);
  }
  const Eu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Li,
    name: Tu,
    parse: Oi,
    structure: vu
  }, Symbol.toStringTag, { value: "Module" })), $u = "SelectorList", Ou = "selector", Lu = {
    children: [[
      "Selector",
      "Raw"
    ]]
  };
  function Pi() {
    const t = this.createList();
    for (; !this.eof; ) {
      if (t.push(this.Selector()), this.tokenType === ft) {
        this.next();
        continue;
      }
      break;
    }
    return {
      type: "SelectorList",
      loc: this.getLocationFromList(t),
      children: t
    };
  }
  function Ri(t) {
    this.children(t, () => this.token(ft, ","));
  }
  const Pu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ri,
    name: $u,
    parse: Pi,
    structure: Lu,
    walkContext: Ou
  }, Symbol.toStringTag, { value: "Module" })), Ru = "String", Iu = {
    value: String
  };
  function Ii() {
    return {
      type: "String",
      loc: this.getLocation(this.tokenStart, this.tokenEnd),
      value: ts(this.consume(At))
    };
  }
  function _i(t) {
    this.token(At, ga(t.value));
  }
  const _u = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: _i,
    name: Ru,
    parse: Ii,
    structure: Iu
  }, Symbol.toStringTag, { value: "Module" })), Nu = 33;
  function er() {
    return this.Raw(null, !1);
  }
  const Du = "StyleSheet", Fu = "stylesheet", Mu = {
    children: [[
      "Comment",
      "CDO",
      "CDC",
      "Atrule",
      "Rule",
      "Raw"
    ]]
  };
  function Ni() {
    const t = this.tokenStart, e = this.createList();
    let n;
    for (; !this.eof; ) {
      switch (this.tokenType) {
        case W:
          this.next();
          continue;
        case Y:
          if (this.charCodeAt(this.tokenStart + 2) !== Nu) {
            this.next();
            continue;
          }
          n = this.Comment();
          break;
        case Fe:
          n = this.CDO();
          break;
        case nt:
          n = this.CDC();
          break;
        // CSS Syntax Module Level 3
        // §2.2 Error handling
        // At the "top level" of a stylesheet, an <at-keyword-token> starts an at-rule.
        case z:
          n = this.parseWithFallback(this.Atrule, er);
          break;
        // Anything else starts a qualified rule ...
        default:
          n = this.parseWithFallback(this.Rule, er);
      }
      e.push(n);
    }
    return {
      type: "StyleSheet",
      loc: this.getLocation(t, this.tokenStart),
      children: e
    };
  }
  function Di(t) {
    this.children(t);
  }
  const ju = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Di,
    name: Du,
    parse: Ni,
    structure: Mu,
    walkContext: Fu
  }, Symbol.toStringTag, { value: "Module" })), Bu = "SupportsDeclaration", Uu = {
    declaration: "Declaration"
  };
  function Fi() {
    const t = this.tokenStart;
    this.eat(I), this.skipSC();
    const e = this.Declaration();
    return this.eof || this.eat(y), {
      type: "SupportsDeclaration",
      loc: this.getLocation(t, this.tokenStart),
      declaration: e
    };
  }
  function Mi(t) {
    this.token(I, "("), this.node(t.declaration), this.token(y, ")");
  }
  const Wu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Mi,
    name: Bu,
    parse: Fi,
    structure: Uu
  }, Symbol.toStringTag, { value: "Module" })), zu = 42, nr = 124;
  function qe() {
    this.tokenType !== d && this.isDelim(zu) === !1 && this.error("Identifier or asterisk is expected"), this.next();
  }
  const Hu = "TypeSelector", Vu = {
    name: String
  };
  function ji() {
    const t = this.tokenStart;
    return this.isDelim(nr) ? (this.next(), qe.call(this)) : (qe.call(this), this.isDelim(nr) && (this.next(), qe.call(this))), {
      type: "TypeSelector",
      loc: this.getLocation(t, this.tokenStart),
      name: this.substrToCursor(t)
    };
  }
  function Bi(t) {
    this.tokenize(t.name);
  }
  const Gu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Bi,
    name: Hu,
    parse: ji,
    structure: Vu
  }, Symbol.toStringTag, { value: "Module" })), Ui = 43, Wi = 45, fn = 63;
  function re(t, e) {
    let n = 0;
    for (let r = this.tokenStart + t; r < this.tokenEnd; r++) {
      const s = this.charCodeAt(r);
      if (s === Wi && e && n !== 0)
        return re.call(this, t + n + 1, !1), -1;
      Xt(s) || this.error(
        e && n !== 0 ? "Hyphen minus" + (n < 6 ? " or hex digit" : "") + " is expected" : n < 6 ? "Hex digit is expected" : "Unexpected input",
        r
      ), ++n > 6 && this.error("Too many hex digits", r);
    }
    return this.next(), n;
  }
  function ke(t) {
    let e = 0;
    for (; this.isDelim(fn); )
      ++e > t && this.error("Too many question marks"), this.next();
  }
  function qu(t) {
    this.charCodeAt(this.tokenStart) !== t && this.error((t === Ui ? "Plus sign" : "Hyphen minus") + " is expected");
  }
  function Ku() {
    let t = 0;
    switch (this.tokenType) {
      case b:
        if (t = re.call(this, 1, !0), this.isDelim(fn)) {
          ke.call(this, 6 - t);
          break;
        }
        if (this.tokenType === E || this.tokenType === b) {
          qu.call(this, Wi), re.call(this, 1, !1);
          break;
        }
        break;
      case E:
        t = re.call(this, 1, !0), t > 0 && ke.call(this, 6 - t);
        break;
      default:
        if (this.eatDelim(Ui), this.tokenType === d) {
          t = re.call(this, 0, !0), t > 0 && ke.call(this, 6 - t);
          break;
        }
        if (this.isDelim(fn)) {
          this.next(), ke.call(this, 5);
          break;
        }
        this.error("Hex digit or question mark is expected");
    }
  }
  const Qu = "UnicodeRange", Yu = {
    value: String
  };
  function zi() {
    const t = this.tokenStart;
    return this.eatIdent("u"), Ku.call(this), {
      type: "UnicodeRange",
      loc: this.getLocation(t, this.tokenStart),
      value: this.substrToCursor(t)
    };
  }
  function Hi(t) {
    this.tokenize(t.value);
  }
  const Xu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Hi,
    name: Qu,
    parse: zi,
    structure: Yu
  }, Symbol.toStringTag, { value: "Module" })), Ju = "Url", Zu = {
    value: String
  };
  function Vi() {
    const t = this.tokenStart;
    let e;
    switch (this.tokenType) {
      case Q:
        e = ba(this.consume(Q));
        break;
      case A:
        this.cmpStr(this.tokenStart, this.tokenEnd, "url(") || this.error("Function name must be `url`"), this.eat(A), this.skipSC(), e = ts(this.consume(At)), this.skipSC(), this.eof || this.eat(y);
        break;
      default:
        this.error("Url or Function is expected");
    }
    return {
      type: "Url",
      loc: this.getLocation(t, this.tokenStart),
      value: e
    };
  }
  function Gi(t) {
    this.token(Q, xa(t.value));
  }
  const th = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Gi,
    name: Ju,
    parse: Vi,
    structure: Zu
  }, Symbol.toStringTag, { value: "Module" })), eh = "Value", nh = {
    children: [[]]
  };
  function qi() {
    const t = this.tokenStart, e = this.readSequence(this.scope.Value);
    return {
      type: "Value",
      loc: this.getLocation(t, this.tokenStart),
      children: e
    };
  }
  function Ki(t) {
    this.children(t);
  }
  const rh = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Ki,
    name: eh,
    parse: qi,
    structure: nh
  }, Symbol.toStringTag, { value: "Module" })), sh = Object.freeze({
    type: "WhiteSpace",
    loc: null,
    value: " "
  }), ih = "WhiteSpace", oh = {
    value: String
  };
  function Qi() {
    return this.eat(W), sh;
  }
  function Yi(t) {
    this.token(W, t.value);
  }
  const ah = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    generate: Yi,
    name: ih,
    parse: Qi,
    structure: oh
  }, Symbol.toStringTag, { value: "Module" })), lh = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    AnPlusB: $a,
    Atrule: Ia,
    AtrulePrelude: Fa,
    AttributeSelector: Va,
    Block: Xa,
    Brackets: tl,
    CDC: rl,
    CDO: ol,
    ClassSelector: ul,
    Combinator: ml,
    Comment: xl,
    Condition: vl,
    Declaration: Bl,
    DeclarationList: Hl,
    Dimension: ql,
    Feature: Xl,
    FeatureFunction: ec,
    FeatureRange: oc,
    Function: uc,
    GeneralEnclosed: pc,
    Hash: kc,
    IdSelector: wc,
    Identifier: bc,
    Layer: Ec,
    LayerList: Lc,
    MediaQuery: Ic,
    MediaQueryList: Dc,
    NestingSelector: Bc,
    Nth: zc,
    Number: Gc,
    Operator: Qc,
    Parentheses: Jc,
    Percentage: eu,
    PseudoClassSelector: iu,
    PseudoElementSelector: cu,
    Ratio: fu,
    Raw: mu,
    Rule: xu,
    Scope: Au,
    Selector: Eu,
    SelectorList: Pu,
    String: _u,
    StyleSheet: ju,
    SupportsDeclaration: Wu,
    TypeSelector: Gu,
    UnicodeRange: Xu,
    Url: th,
    Value: rh,
    WhiteSpace: ah
  }, Symbol.toStringTag, { value: "Module" })), ch = {
    node: lh
  }, $t = Aa(ch), An = [
    "left",
    "right",
    "top",
    "bottom",
    "inset-block-start",
    "inset-block-end",
    "inset-inline-start",
    "inset-inline-end",
    "inset-block",
    "inset-inline",
    "inset"
  ];
  function ue(t) {
    return An.includes(t);
  }
  const Tn = [
    "margin-block-start",
    "margin-block-end",
    "margin-block",
    "margin-inline-start",
    "margin-inline-end",
    "margin-inline",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "margin-top",
    "margin"
  ];
  function uh(t) {
    return Tn.includes(t);
  }
  const vn = [
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "block-size",
    "inline-size",
    "min-block-size",
    "min-inline-size",
    "max-block-size",
    "max-inline-size"
  ];
  function Xi(t) {
    return vn.includes(t);
  }
  const Ji = [
    "justify-self",
    "align-self",
    "place-self"
  ];
  function hh(t) {
    return Ji.includes(t);
  }
  const Zi = [
    ...An,
    ...Tn,
    ...vn,
    ...Ji,
    "position-anchor",
    "position-area"
  ], fh = [
    ...vn,
    ...An,
    ...Tn
  ];
  function to(t) {
    return fh.includes(
      t
    );
  }
  const ph = [
    "top",
    "left",
    "right",
    "bottom",
    "start",
    "end",
    "self-start",
    "self-end",
    "center",
    "inside",
    "outside"
  ];
  function eo(t) {
    return ph.includes(t);
  }
  const dh = [
    "width",
    "height",
    "block",
    "inline",
    "self-block",
    "self-inline"
  ];
  function gh(t) {
    return dh.includes(t);
  }
  const rr = /* @__PURE__ */ new Set(["Atrule", "Selector", "Declaration"]);
  function mh(t) {
    const e = new SourceMapGenerator(), n = {
      line: 1,
      column: 0
    }, r = {
      line: 0,
      // should be zero to add first mapping
      column: 0
    }, s = {
      line: 1,
      column: 0
    }, o = {
      generated: s
    };
    let a = 1, l = 0, u = !1;
    const i = t.node;
    t.node = function(f) {
      if (f.loc && f.loc.start && rr.has(f.type)) {
        const p = f.loc.start.line, g = f.loc.start.column - 1;
        (r.line !== p || r.column !== g) && (r.line = p, r.column = g, n.line = a, n.column = l, u && (u = !1, (n.line !== s.line || n.column !== s.column) && e.addMapping(o)), u = !0, e.addMapping({
          source: f.loc.source,
          original: r,
          generated: n
        }));
      }
      i.call(this, f), u && rr.has(f.type) && (s.line = a, s.column = l);
    };
    const c = t.emit;
    t.emit = function(f, p, g) {
      for (let m = 0; m < f.length; m++)
        f.charCodeAt(m) === 10 ? (a++, l = 0) : l++;
      c(f, p, g);
    };
    const h = t.result;
    return t.result = function() {
      return u && e.addMapping(o), {
        css: h(),
        map: e
      };
    }, t;
  }
  const kh = 43, Sh = 45, Ke = (t, e) => {
    if (t === O && (t = e), typeof t == "string") {
      const n = t.charCodeAt(0);
      return n > 127 ? 32768 : n << 8;
    }
    return t;
  }, no = [
    [d, d],
    [d, A],
    [d, Q],
    [d, at],
    [d, "-"],
    [d, b],
    [d, F],
    [d, E],
    [d, nt],
    [d, I],
    [z, d],
    [z, A],
    [z, Q],
    [z, at],
    [z, "-"],
    [z, b],
    [z, F],
    [z, E],
    [z, nt],
    [_, d],
    [_, A],
    [_, Q],
    [_, at],
    [_, "-"],
    [_, b],
    [_, F],
    [_, E],
    [_, nt],
    [E, d],
    [E, A],
    [E, Q],
    [E, at],
    [E, "-"],
    [E, b],
    [E, F],
    [E, E],
    [E, nt],
    ["#", d],
    ["#", A],
    ["#", Q],
    ["#", at],
    ["#", "-"],
    ["#", b],
    ["#", F],
    ["#", E],
    ["#", nt],
    // https://github.com/w3c/csswg-drafts/pull/6874
    ["-", d],
    ["-", A],
    ["-", Q],
    ["-", at],
    ["-", "-"],
    ["-", b],
    ["-", F],
    ["-", E],
    ["-", nt],
    // https://github.com/w3c/csswg-drafts/pull/6874
    [b, d],
    [b, A],
    [b, Q],
    [b, at],
    [b, b],
    [b, F],
    [b, E],
    [b, "%"],
    [b, nt],
    // https://github.com/w3c/csswg-drafts/pull/6874
    ["@", d],
    ["@", A],
    ["@", Q],
    ["@", at],
    ["@", "-"],
    ["@", nt],
    // https://github.com/w3c/csswg-drafts/pull/6874
    [".", b],
    [".", F],
    [".", E],
    ["+", b],
    ["+", F],
    ["+", E],
    ["/", "*"]
  ], yh = no.concat([
    [d, _],
    [E, _],
    [_, _],
    [z, I],
    [z, At],
    [z, X],
    [F, F],
    [F, E],
    [F, A],
    [F, "-"],
    [y, d],
    [y, A],
    [y, F],
    [y, E],
    [y, _],
    [y, "-"]
  ]);
  function ro(t) {
    const e = new Set(
      t.map(([n, r]) => Ke(n) << 16 | Ke(r))
    );
    return function(n, r, s) {
      const o = Ke(r, s), a = s.charCodeAt(0);
      return (a === Sh && r !== d && r !== A && r !== nt || a === kh ? e.has(n << 16 | a << 8) : e.has(n << 16 | o)) && this.emit(" ", W, !0), o;
    };
  }
  const bh = ro(no), so = ro(yh), sr = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    safe: so,
    spec: bh
  }, Symbol.toStringTag, { value: "Module" })), xh = 92;
  function Ch(t, e) {
    if (typeof e == "function") {
      let n = null;
      t.children.forEach((r) => {
        n !== null && e.call(this, n), this.node(r), n = r;
      });
      return;
    }
    t.children.forEach(this.node, this);
  }
  function wh(t) {
    Jr(t, (e, n, r) => {
      this.token(e, t.slice(n, r));
    });
  }
  function Ah(t) {
    const e = /* @__PURE__ */ new Map();
    for (let [n, r] of Object.entries(t.node))
      typeof (r.generate || r) == "function" && e.set(n, r.generate || r);
    return function(n, r) {
      let s = "", o = 0, a = {
        node(u) {
          if (e.has(u.type))
            e.get(u.type).call(l, u);
          else
            throw new Error("Unknown node type: " + u.type);
        },
        tokenBefore: so,
        token(u, i) {
          o = this.tokenBefore(o, u, i), this.emit(i, u, !1), u === O && i.charCodeAt(0) === xh && this.emit(`
`, W, !0);
        },
        emit(u) {
          s += u;
        },
        result() {
          return s;
        }
      };
      r && (typeof r.decorator == "function" && (a = r.decorator(a)), r.sourceMap && (a = mh(a)), r.mode in sr && (a.tokenBefore = sr[r.mode]));
      const l = {
        node: (u) => a.node(u),
        children: Ch,
        token: (u, i) => a.token(u, i),
        tokenize: wh
      };
      return a.node(n), a.result();
    };
  }
  const Th = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    AnPlusB: rs,
    Atrule: is,
    AtrulePrelude: as,
    AttributeSelector: us,
    Block: ps,
    Brackets: gs,
    CDC: ks,
    CDO: ys,
    ClassSelector: xs,
    Combinator: ws,
    Comment: Ts,
    Condition: Es,
    Declaration: Ls,
    DeclarationList: Rs,
    Dimension: _s,
    Feature: Ds,
    FeatureFunction: Ms,
    FeatureRange: Bs,
    Function: Ws,
    GeneralEnclosed: Hs,
    Hash: Gs,
    IdSelector: Ys,
    Identifier: Ks,
    Layer: Js,
    LayerList: ti,
    MediaQuery: ni,
    MediaQueryList: si,
    NestingSelector: oi,
    Nth: li,
    Number: ui,
    Operator: fi,
    Parentheses: di,
    Percentage: mi,
    PseudoClassSelector: Si,
    PseudoElementSelector: bi,
    Ratio: Ci,
    Raw: Ai,
    Rule: vi,
    Scope: $i,
    Selector: Li,
    SelectorList: Ri,
    String: _i,
    StyleSheet: Di,
    SupportsDeclaration: Mi,
    TypeSelector: Bi,
    UnicodeRange: Hi,
    Url: Gi,
    Value: Ki,
    WhiteSpace: Yi
  }, Symbol.toStringTag, { value: "Module" })), vh = {
    node: Th
  }, Eh = Ah(vh);
  function $h(t, e) {
    const n = Object.create(SyntaxError.prototype), r = new Error();
    return Object.assign(n, {
      name: t,
      message: e,
      get stack() {
        return (r.stack || "").replace(/^(.+\n){1,3}/, `${t}: ${e}
`);
      }
    });
  }
  const Qe = 100, ir = 60, or = "    ";
  function ar({ source: t, line: e, column: n, baseLine: r, baseColumn: s }, o) {
    function a(g, m) {
      return i.slice(g, m).map(
        (k, S) => String(g + S + 1).padStart(f) + " |" + k
      ).join(`
`);
    }
    const l = `
`.repeat(Math.max(r - 1, 0)), u = " ".repeat(Math.max(s - 1, 0)), i = (l + u + t).split(/\r\n?|\n|\f/), c = Math.max(1, e - o) - 1, h = Math.min(e + o, i.length + 1), f = Math.max(4, String(h).length) + 1;
    let p = 0;
    n += (or.length - 1) * (i[e - 1].substr(0, n - 1).match(/\t/g) || []).length, n > Qe && (p = n - ir + 3, n = ir - 2);
    for (let g = c; g <= h; g++)
      g >= 0 && g < i.length && (i[g] = i[g].replace(/\t/g, or), i[g] = (p > 0 && i[g].length > p ? "…" : "") + i[g].substr(p, Qe - 2) + (i[g].length > p + Qe - 1 ? "…" : ""));
    return [
      a(c, e),
      new Array(n + f + 2).join("-") + "^",
      a(e, h)
    ].filter(Boolean).join(`
`).replace(/^(\s+\d+\s+\|\n)+/, "").replace(/\n(\s+\d+\s+\|)+$/, "");
  }
  function lr(t, e, n, r, s, o = 1, a = 1) {
    return Object.assign($h("SyntaxError", t), {
      source: e,
      offset: n,
      line: r,
      column: s,
      sourceFragment(u) {
        return ar({ source: e, line: r, column: s, baseLine: o, baseColumn: a }, isNaN(u) ? 0 : u);
      },
      get formattedMessage() {
        return `Parse error: ${t}
` + ar({ source: e, line: r, column: s, baseLine: o, baseColumn: a }, 2);
      }
    });
  }
  function Oh(t) {
    const e = this.createList();
    let n = !1;
    const r = {
      recognizer: t
    };
    for (; !this.eof; ) {
      switch (this.tokenType) {
        case Y:
          this.next();
          continue;
        case W:
          n = !0, this.next();
          continue;
      }
      let s = t.getNode.call(this, r);
      if (s === void 0)
        break;
      n && (t.onWhiteSpace && t.onWhiteSpace.call(this, s, e, r), n = !1), e.push(s);
    }
    return n && t.onWhiteSpace && t.onWhiteSpace.call(this, null, e, r), e;
  }
  const cr = () => {
  }, Lh = 33, Ph = 35, Ye = 59, ur = 123, hr = 0;
  function Rh(t) {
    return function() {
      return this[t]();
    };
  }
  function Xe(t) {
    const e = /* @__PURE__ */ Object.create(null);
    for (const n of Object.keys(t)) {
      const r = t[n], s = r.parse || r;
      s && (e[n] = s);
    }
    return e;
  }
  function Ih(t) {
    const e = {
      context: /* @__PURE__ */ Object.create(null),
      features: Object.assign(/* @__PURE__ */ Object.create(null), t.features),
      scope: Object.assign(/* @__PURE__ */ Object.create(null), t.scope),
      atrule: Xe(t.atrule),
      pseudo: Xe(t.pseudo),
      node: Xe(t.node)
    };
    for (const [n, r] of Object.entries(t.parseContext))
      switch (typeof r) {
        case "function":
          e.context[n] = r;
          break;
        case "string":
          e.context[n] = Rh(r);
          break;
      }
    return U(U({
      config: e
    }, e), e.node);
  }
  function _h(t) {
    let e = "", n = "<unknown>", r = !1, s = cr, o = !1;
    const a = new ha(), l = Object.assign(new fa(), Ih(t || {}), {
      parseAtrulePrelude: !0,
      parseRulePrelude: !0,
      parseValue: !0,
      parseCustomProperty: !1,
      readSequence: Oh,
      consumeUntilBalanceEnd: () => 0,
      consumeUntilLeftCurlyBracket(i) {
        return i === ur ? 1 : 0;
      },
      consumeUntilLeftCurlyBracketOrSemicolon(i) {
        return i === ur || i === Ye ? 1 : 0;
      },
      consumeUntilExclamationMarkOrSemicolon(i) {
        return i === Lh || i === Ye ? 1 : 0;
      },
      consumeUntilSemicolonIncluded(i) {
        return i === Ye ? 2 : 0;
      },
      createList() {
        return new q();
      },
      createSingleNodeList(i) {
        return new q().appendData(i);
      },
      getFirstListNode(i) {
        return i && i.first;
      },
      getLastListNode(i) {
        return i && i.last;
      },
      parseWithFallback(i, c) {
        const h = this.tokenIndex;
        try {
          return i.call(this);
        } catch (f) {
          if (o)
            throw f;
          this.skip(h - this.tokenIndex);
          const p = c.call(this);
          return o = !0, s(f, p), o = !1, p;
        }
      },
      lookupNonWSType(i) {
        let c;
        do
          if (c = this.lookupType(i++), c !== W && c !== Y)
            return c;
        while (c !== hr);
        return hr;
      },
      charCodeAt(i) {
        return i >= 0 && i < e.length ? e.charCodeAt(i) : 0;
      },
      substring(i, c) {
        return e.substring(i, c);
      },
      substrToCursor(i) {
        return this.source.substring(i, this.tokenStart);
      },
      cmpChar(i, c) {
        return Kr(e, i, c);
      },
      cmpStr(i, c, h) {
        return Le(e, i, c, h);
      },
      consume(i) {
        const c = this.tokenStart;
        return this.eat(i), this.substrToCursor(c);
      },
      consumeFunctionName() {
        const i = e.substring(this.tokenStart, this.tokenEnd - 1);
        return this.eat(A), i;
      },
      consumeNumber(i) {
        const c = e.substring(this.tokenStart, Qr(e, this.tokenStart));
        return this.eat(i), c;
      },
      eat(i) {
        if (this.tokenType !== i) {
          const c = Xr[i].slice(0, -6).replace(/-/g, " ").replace(/^./, (p) => p.toUpperCase());
          let h = `${/[[\](){}]/.test(c) ? `"${c}"` : c} is expected`, f = this.tokenStart;
          switch (i) {
            case d:
              this.tokenType === A || this.tokenType === Q ? (f = this.tokenEnd - 1, h = "Identifier is expected but function found") : h = "Identifier is expected";
              break;
            case _:
              this.isDelim(Ph) && (this.next(), f++, h = "Name is expected");
              break;
            case F:
              this.tokenType === b && (f = this.tokenEnd, h = "Percent sign is expected");
              break;
          }
          this.error(h, f);
        }
        this.next();
      },
      eatIdent(i) {
        (this.tokenType !== d || this.lookupValue(0, i) === !1) && this.error(`Identifier "${i}" is expected`), this.next();
      },
      eatDelim(i) {
        this.isDelim(i) || this.error(`Delim "${String.fromCharCode(i)}" is expected`), this.next();
      },
      getLocation(i, c) {
        return r ? a.getLocationRange(
          i,
          c,
          n
        ) : null;
      },
      getLocationFromList(i) {
        if (r) {
          const c = this.getFirstListNode(i), h = this.getLastListNode(i);
          return a.getLocationRange(
            c !== null ? c.loc.start.offset - a.startOffset : this.tokenStart,
            h !== null ? h.loc.end.offset - a.startOffset : this.tokenStart,
            n
          );
        }
        return null;
      },
      error(i, c) {
        const h = typeof c != "undefined" && c < e.length ? a.getLocation(c) : this.eof ? a.getLocation(la(e, e.length - 1)) : a.getLocation(this.tokenStart);
        throw new lr(
          i || "Unexpected input",
          e,
          h.offset,
          h.line,
          h.column,
          a.startLine,
          a.startColumn
        );
      }
    });
    return Object.assign(function(i, c) {
      e = i, c = c || {}, l.setSource(e, Jr), a.setSource(
        e,
        c.offset,
        c.line,
        c.column
      ), n = c.filename || "<unknown>", r = !!c.positions, s = typeof c.onParseError == "function" ? c.onParseError : cr, o = !1, l.parseAtrulePrelude = "parseAtrulePrelude" in c ? !!c.parseAtrulePrelude : !0, l.parseRulePrelude = "parseRulePrelude" in c ? !!c.parseRulePrelude : !0, l.parseValue = "parseValue" in c ? !!c.parseValue : !0, l.parseCustomProperty = "parseCustomProperty" in c ? !!c.parseCustomProperty : !1;
      const { context: h = "default", onComment: f } = c;
      if (!(h in l.context))
        throw new Error("Unknown context `" + h + "`");
      typeof f == "function" && l.forEachToken((g, m, k) => {
        if (g === Y) {
          const S = l.getLocation(m, k), x = Le(e, k - 2, k, "*/") ? e.slice(m + 2, k - 2) : e.slice(m + 2, k);
          f(x, S);
        }
      });
      const p = l.context[h].call(l, c);
      return l.eof || l.error(), p;
    }, {
      SyntaxError: lr,
      config: l.config
    });
  }
  const Nh = 35, Dh = 42, fr = 43, Fh = 45, Mh = 47, jh = 117;
  function io(t) {
    switch (this.tokenType) {
      case _:
        return this.Hash();
      case ft:
        return this.Operator();
      case I:
        return this.Parentheses(this.readSequence, t.recognizer);
      case ee:
        return this.Brackets(this.readSequence, t.recognizer);
      case At:
        return this.String();
      case E:
        return this.Dimension();
      case F:
        return this.Percentage();
      case b:
        return this.Number();
      case A:
        return this.cmpStr(this.tokenStart, this.tokenEnd, "url(") ? this.Url() : this.Function(this.readSequence, t.recognizer);
      case Q:
        return this.Url();
      case d:
        return this.cmpChar(this.tokenStart, jh) && this.cmpChar(this.tokenStart + 1, fr) ? this.UnicodeRange() : this.Identifier();
      case O: {
        const e = this.charCodeAt(this.tokenStart);
        if (e === Mh || e === Dh || e === fr || e === Fh)
          return this.Operator();
        e === Nh && this.error("Hex or identifier is expected", this.tokenStart + 1);
        break;
      }
    }
  }
  const Bh = {
    getNode: io
  }, Uh = 35, Wh = 38, zh = 42, Hh = 43, Vh = 47, pr = 46, Gh = 62, qh = 124, Kh = 126;
  function Qh(t, e) {
    e.last !== null && e.last.type !== "Combinator" && t !== null && t.type !== "Combinator" && e.push({
      // FIXME: this.Combinator() should be used instead
      type: "Combinator",
      loc: null,
      name: " "
    });
  }
  function Yh() {
    switch (this.tokenType) {
      case ee:
        return this.AttributeSelector();
      case _:
        return this.IdSelector();
      case X:
        return this.lookupType(1) === X ? this.PseudoElementSelector() : this.PseudoClassSelector();
      case d:
        return this.TypeSelector();
      case b:
      case F:
        return this.Percentage();
      case E:
        this.charCodeAt(this.tokenStart) === pr && this.error("Identifier is expected", this.tokenStart + 1);
        break;
      case O: {
        switch (this.charCodeAt(this.tokenStart)) {
          case Hh:
          case Gh:
          case Kh:
          case Vh:
            return this.Combinator();
          case pr:
            return this.ClassSelector();
          case zh:
          case qh:
            return this.TypeSelector();
          case Uh:
            return this.IdSelector();
          case Wh:
            return this.NestingSelector();
        }
        break;
      }
    }
  }
  const Xh = {
    onWhiteSpace: Qh,
    getNode: Yh
  };
  function Jh() {
    return this.createSingleNodeList(
      this.Raw(null, !1)
    );
  }
  function Zh() {
    const t = this.createList();
    if (this.skipSC(), t.push(this.Identifier()), this.skipSC(), this.tokenType === ft) {
      t.push(this.Operator());
      const e = this.tokenIndex, n = this.parseCustomProperty ? this.Value(null) : this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !1);
      if (n.type === "Value" && n.children.isEmpty) {
        for (let r = e - this.tokenIndex; r <= 0; r++)
          if (this.lookupType(r) === W) {
            n.children.appendData({
              type: "WhiteSpace",
              loc: null,
              value: " "
            });
            break;
          }
      }
      t.push(n);
    }
    return t;
  }
  function dr(t) {
    return t !== null && t.type === "Operator" && (t.value[t.value.length - 1] === "-" || t.value[t.value.length - 1] === "+");
  }
  const tf = {
    getNode: io,
    onWhiteSpace(t, e) {
      dr(t) && (t.value = " " + t.value), dr(e.last) && (e.last.value += " ");
    },
    expression: Jh,
    var: Zh
  }, ef = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    AtrulePrelude: Bh,
    Selector: Xh,
    Value: tf
  }, Symbol.toStringTag, { value: "Module" })), nf = /* @__PURE__ */ new Set(["none", "and", "not", "or"]), rf = {
    parse: {
      prelude() {
        const t = this.createList();
        if (this.tokenType === d) {
          const e = this.substring(this.tokenStart, this.tokenEnd);
          nf.has(e.toLowerCase()) || t.push(this.Identifier());
        }
        return t.push(this.Condition("container")), t;
      },
      block(t = !1) {
        return this.Block(t);
      }
    }
  }, sf = {
    parse: {
      prelude: null,
      block() {
        return this.Block(!0);
      }
    }
  };
  function Je(t, e) {
    return this.parseWithFallback(
      () => {
        try {
          return t.call(this);
        } finally {
          this.skipSC(), this.lookupNonWSType(0) !== y && this.error();
        }
      },
      e || (() => this.Raw(null, !0))
    );
  }
  const gr = {
    layer() {
      this.skipSC();
      const t = this.createList(), e = Je.call(this, this.Layer);
      return (e.type !== "Raw" || e.value !== "") && t.push(e), t;
    },
    supports() {
      this.skipSC();
      const t = this.createList(), e = Je.call(
        this,
        this.Declaration,
        () => Je.call(this, () => this.Condition("supports"))
      );
      return (e.type !== "Raw" || e.value !== "") && t.push(e), t;
    }
  }, of = {
    parse: {
      prelude() {
        const t = this.createList();
        switch (this.tokenType) {
          case At:
            t.push(this.String());
            break;
          case Q:
          case A:
            t.push(this.Url());
            break;
          default:
            this.error("String or url() is expected");
        }
        return this.skipSC(), this.tokenType === d && this.cmpStr(this.tokenStart, this.tokenEnd, "layer") ? t.push(this.Identifier()) : this.tokenType === A && this.cmpStr(this.tokenStart, this.tokenEnd, "layer(") && t.push(this.Function(null, gr)), this.skipSC(), this.tokenType === A && this.cmpStr(this.tokenStart, this.tokenEnd, "supports(") && t.push(this.Function(null, gr)), (this.lookupNonWSType(0) === d || this.lookupNonWSType(0) === I) && t.push(this.MediaQueryList()), t;
      },
      block: null
    }
  }, af = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.LayerList()
        );
      },
      block() {
        return this.Block(!1);
      }
    }
  }, lf = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.MediaQueryList()
        );
      },
      block(t = !1) {
        return this.Block(t);
      }
    }
  }, cf = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.SelectorList()
        );
      },
      block() {
        return this.Block(!0);
      }
    }
  }, uf = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.SelectorList()
        );
      },
      block() {
        return this.Block(!0);
      }
    }
  }, hf = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.Scope()
        );
      },
      block(t = !1) {
        return this.Block(t);
      }
    }
  }, ff = {
    parse: {
      prelude: null,
      block(t = !1) {
        return this.Block(t);
      }
    }
  }, pf = {
    parse: {
      prelude() {
        return this.createSingleNodeList(
          this.Condition("supports")
        );
      },
      block(t = !1) {
        return this.Block(t);
      }
    }
  }, df = {
    container: rf,
    "font-face": sf,
    import: of,
    layer: af,
    media: lf,
    nest: cf,
    page: uf,
    scope: hf,
    "starting-style": ff,
    supports: pf
  };
  function gf() {
    const t = this.createList();
    this.skipSC();
    t: for (; !this.eof; ) {
      switch (this.tokenType) {
        case d:
          t.push(this.Identifier());
          break;
        case At:
          t.push(this.String());
          break;
        case ft:
          t.push(this.Operator());
          break;
        case y:
          break t;
        default:
          this.error("Identifier, string or comma is expected");
      }
      this.skipSC();
    }
    return t;
  }
  const Rt = {
    parse() {
      return this.createSingleNodeList(
        this.SelectorList()
      );
    }
  }, Ze = {
    parse() {
      return this.createSingleNodeList(
        this.Selector()
      );
    }
  }, mf = {
    parse() {
      return this.createSingleNodeList(
        this.Identifier()
      );
    }
  }, kf = {
    parse: gf
  }, Se = {
    parse() {
      return this.createSingleNodeList(
        this.Nth()
      );
    }
  }, Sf = {
    dir: mf,
    has: Rt,
    lang: kf,
    matches: Rt,
    is: Rt,
    "-moz-any": Rt,
    "-webkit-any": Rt,
    where: Rt,
    not: Rt,
    "nth-child": Se,
    "nth-last-child": Se,
    "nth-last-of-type": Se,
    "nth-of-type": Se,
    slotted: Ze,
    host: Ze,
    "host-context": Ze
  }, yf = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    AnPlusB: ns,
    Atrule: ss,
    AtrulePrelude: os,
    AttributeSelector: cs,
    Block: fs,
    Brackets: ds,
    CDC: ms,
    CDO: Ss,
    ClassSelector: bs,
    Combinator: Cs,
    Comment: As,
    Condition: vs,
    Declaration: Os,
    DeclarationList: Ps,
    Dimension: Is,
    Feature: Ns,
    FeatureFunction: Fs,
    FeatureRange: js,
    Function: Us,
    GeneralEnclosed: zs,
    Hash: Vs,
    IdSelector: Qs,
    Identifier: qs,
    Layer: Xs,
    LayerList: Zs,
    MediaQuery: ei,
    MediaQueryList: ri,
    NestingSelector: ii,
    Nth: ai,
    Number: ci,
    Operator: hi,
    Parentheses: pi,
    Percentage: gi,
    PseudoClassSelector: ki,
    PseudoElementSelector: yi,
    Ratio: xi,
    Raw: wi,
    Rule: Ti,
    Scope: Ei,
    Selector: Oi,
    SelectorList: Pi,
    String: Ii,
    StyleSheet: Ni,
    SupportsDeclaration: Fi,
    TypeSelector: ji,
    UnicodeRange: zi,
    Url: Vi,
    Value: qi,
    WhiteSpace: Qi
  }, Symbol.toStringTag, { value: "Module" })), bf = {
    parseContext: {
      default: "StyleSheet",
      stylesheet: "StyleSheet",
      atrule: "Atrule",
      atrulePrelude(t) {
        return this.AtrulePrelude(t.atrule ? String(t.atrule) : null);
      },
      mediaQueryList: "MediaQueryList",
      mediaQuery: "MediaQuery",
      condition(t) {
        return this.Condition(t.kind);
      },
      rule: "Rule",
      selectorList: "SelectorList",
      selector: "Selector",
      block() {
        return this.Block(!0);
      },
      declarationList: "DeclarationList",
      declaration: "Declaration",
      value: "Value"
    },
    features: {
      supports: {
        selector() {
          return this.Selector();
        }
      },
      container: {
        style() {
          return this.Declaration();
        }
      }
    },
    scope: ef,
    atrule: df,
    pseudo: Sf,
    node: yf
  }, xf = _h(bf);
  let Cf = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict", lt = (t = 21) => {
    let e = "", n = t | 0;
    for (; n--; )
      e += Cf[Math.random() * 64 | 0];
    return e;
  };
  const oo = lt(), se = /* @__PURE__ */ new Set();
  function Re(t) {
    return !!(t && t.type === "Function" && t.name === "anchor");
  }
  function Ot(t, e = !1) {
    return xf(t, {
      parseAtrulePrelude: !1,
      parseCustomProperty: !0,
      onParseError: (n) => {
        e && se.add(n);
      }
    });
  }
  function Z(t) {
    return Eh(t, {
      // Default `safe` adds extra (potentially breaking) spaces for compatibility
      // with old browsers.
      mode: "spec"
    });
  }
  function ao(t) {
    return t.type === "Declaration";
  }
  function wf(t) {
    return t.toArray().reduce(
      (e, n) => n.type === "Operator" && n.value === "," ? (e.push([]), e) : (n.type === "Identifier" && e[e.length - 1].push(n), e),
      [[]]
    );
  }
  function pn(t) {
    return t ? t.children.map((e) => {
      var s;
      let n;
      ((s = e.children.last) == null ? void 0 : s.type) === "PseudoElementSelector" && (e = Ee(e), n = Z(e.children.last), e.children.pop());
      const r = Z(e);
      return {
        selector: r + (n != null ? n : ""),
        elementPart: r,
        pseudoElementPart: n
      };
    }).toArray() : [];
  }
  function Af() {
    se.size > 0 && (console.group(
      `The CSS anchor positioning polyfill was not applied due to ${se.size === 1 ? "a CSS parse error" : "CSS parse errors"}.`
    ), se.forEach((t) => {
      console.warn(t.formattedMessage);
    }), console.groupEnd());
  }
  function Tf() {
    se.clear();
  }
  const dn = [
    ...Zi,
    "anchor-scope",
    "anchor-name"
  ].reduce(
    (t, e) => (t[e] = `--${e}-${oo}`, t),
    {}
  );
  function vf(t, e) {
    return ao(t) && dn[t.property] && e ? (e.children.appendData(G(U({}, t), {
      property: dn[t.property]
    })), { updated: !0 }) : { updated: !1 };
  }
  function Ef(t, e) {
    const n = ["inset", "inset-block", "inset-inline"];
    if (!ao(t) || !e || !n.includes(t.property))
      return { updated: !1 };
    const r = (s, o) => {
      o && e.children.appendData(G(U({}, t), {
        property: s,
        value: {
          type: "Value",
          children: new q().fromArray([o])
        }
      }));
    };
    if (t.property === "inset") {
      const s = t.value.children.toArray(), [o, a, l, u] = (() => {
        switch (s.length) {
          case 1:
            return [s[0], s[0], s[0], s[0]];
          case 2:
            return [s[0], s[1], s[0], s[1]];
          case 3:
            return [s[0], s[1], s[2], s[1]];
          case 4:
            return [s[0], s[1], s[2], s[3]];
          default:
            return [];
        }
      })();
      r("top", o), r("right", a), r("bottom", l), r("left", u);
    } else if (t.property === "inset-block") {
      const s = t.value.children.toArray(), [o, a] = (() => {
        switch (s.length) {
          case 1:
            return [s[0], s[0]];
          case 2:
            return [s[0], s[1]];
          default:
            return [];
        }
      })();
      r("inset-block-start", o), r("inset-block-end", a);
    } else if (t.property === "inset-inline") {
      const s = t.value.children.toArray(), [o, a] = (() => {
        switch (s.length) {
          case 1:
            return [s[0], s[0]];
          case 2:
            return [s[0], s[1]];
          default:
            return [];
        }
      })();
      r("inset-inline-start", o), r("inset-inline-end", a);
    }
    return { updated: !0 };
  }
  function $f(t) {
    for (const e of t) {
      let n = !1;
      const r = Ot(e.css, !0);
      $t(r, {
        visit: "Declaration",
        enter(s) {
          var u;
          const o = (u = this.rule) == null ? void 0 : u.block, { updated: a } = Ef(
            s,
            o
          ), { updated: l } = vf(s, o);
          (l || a) && (n = !0);
        }
      }), n && (e.css = Z(r), e.changed = !0);
    }
    return t.some((e) => e.changed === !0);
  }
  var lo = /* @__PURE__ */ ((t) => (t.All = "all", t.None = "none", t))(lo || {});
  function ot(t, e) {
    var r;
    return e = (r = dn[e]) != null ? r : e, (t instanceof HTMLElement ? getComputedStyle(t) : t.computedStyle).getPropertyValue(e).trim();
  }
  function Zt(t, e, n) {
    return ot(t, e) === n;
  }
  function Of(t, { selector: e, pseudoElementPart: n }) {
    const r = getComputedStyle(t, n), s = document.createElement("div"), o = document.createElement("style");
    s.id = `fake-pseudo-element-${lt()}`;
    for (const l of Array.from(r)) {
      const u = r.getPropertyValue(l);
      s.style.setProperty(l, u);
    }
    o.textContent += `#${s.id}${n} { content: ${r.content}; }`, o.textContent += `${e} { display: none !important; }`, document.head.append(o);
    const a = n === "::before" ? "afterbegin" : "beforeend";
    return t.insertAdjacentElement(a, s), { fakePseudoElement: s, sheet: o, computedStyle: r };
  }
  function Lf(t) {
    let e = t;
    for (; e; ) {
      if (Zt(e, "overflow", "scroll"))
        return e;
      e = e.parentElement;
    }
    return e;
  }
  function Pf(t) {
    let e = Lf(t);
    return e === document.documentElement && (e = null), e != null ? e : { scrollTop: 0, scrollLeft: 0 };
  }
  function Rf(t, e) {
    const { elementPart: n, pseudoElementPart: r } = t, s = [];
    if (r && !(r === "::before" || r === "::after")) return s;
    const l = ie(e.roots, n);
    if (!r)
      return s.push(...l), s;
    for (const u of l) {
      const { fakePseudoElement: i, sheet: c, computedStyle: h } = Of(
        u,
        t
      ), f = i.getBoundingClientRect(), { scrollY: p, scrollX: g } = globalThis, m = Pf(u);
      s.push({
        fakePseudoElement: i,
        computedStyle: h,
        removeFakePseudoElement() {
          i.remove(), c.remove();
        },
        // For https://floating-ui.com/docs/autoupdate#ancestorscroll to work on
        // `VirtualElement`s.
        contextElement: u,
        // https://floating-ui.com/docs/virtual-elements
        getBoundingClientRect() {
          const { scrollY: k, scrollX: S } = globalThis, { scrollTop: x, scrollLeft: T } = m;
          return DOMRect.fromRect({
            y: f.y + (p - k) + (m.scrollTop - x),
            x: f.x + (g - S) + (m.scrollLeft - T),
            width: f.width,
            height: f.height
          });
        }
      });
    }
    return s;
  }
  function If(t, e) {
    const n = ot(t, "anchor-name");
    return e ? n.split(",").map((r) => r.trim()).includes(e) : !n;
  }
  function _f(t, e) {
    const n = ot(t, "anchor-scope");
    return n === e || n === "all";
  }
  const En = (t) => R(null, null, function* () {
    var n, r, s;
    let e = yield (n = H.getOffsetParent) == null ? void 0 : n.call(H, t);
    return (yield (r = H.isElement) == null ? void 0 : r.call(H, e)) || (e = (yield (s = H.getDocumentElement) == null ? void 0 : s.call(H, t)) || window.document.documentElement), e;
  }), ie = (t, e) => t.flatMap(
    (n) => [...n.querySelectorAll(e)]
  ), mr = "InvalidMimeType";
  function Nf(t) {
    return !!((t.type === "text/css" || t.rel === "stylesheet") && t.href);
  }
  function Df(t) {
    const e = new URL(t.href, document.baseURI);
    if (Nf(t) && e.origin === location.origin)
      return e;
  }
  function Ff(t) {
    return R(this, null, function* () {
      return (yield Promise.all(
        t.map((n) => R(null, null, function* () {
          var r;
          if (!n.url)
            return n;
          if ((r = n.el) != null && r.disabled)
            return null;
          try {
            const s = yield fetch(n.url.toString()), o = s.headers.get("content-type");
            if (!(o != null && o.startsWith("text/css"))) {
              const l = new Error(
                `Error loading ${n.url}: expected content-type "text/css", got "${o}".`
              );
              throw l.name = mr, l;
            }
            const a = yield s.text();
            return G(U({}, n), { css: a });
          } catch (s) {
            if (s instanceof Error && s.name === mr)
              return console.warn(s), null;
            throw s;
          }
        }))
      )).filter((n) => n !== null);
    });
  }
  const kr = '[style*="anchor"]', Sr = '[style*="position-area"]';
  function Mf(t) {
    const e = t ? t.filter(
      (r) => r instanceof HTMLElement && (r.matches(kr) || r.matches(Sr))
    ) : Array.from(
      document.querySelectorAll(
        [
          kr,
          Sr
        ].join(",")
      )
    ), n = [];
    return e.filter((r) => r instanceof HTMLElement).forEach((r) => {
      const s = lt(12), o = "data-has-inline-styles";
      r.setAttribute(o, s);
      const a = r.getAttribute("style"), l = `[${o}="${s}"] { ${a} }`;
      n.push({ el: r, css: l });
    }), n;
  }
  function jf(t) {
    return R(this, null, function* () {
      var o, a;
      const e = (o = t.elements) != null ? o : ie(t.roots, "link, style"), n = [];
      e.filter((l) => l instanceof HTMLElement).forEach((l) => {
        if (l.tagName.toLowerCase() === "link") {
          const u = Df(l);
          u && n.push({ el: l, url: u });
        }
        l.tagName.toLowerCase() === "style" && n.push({ el: l, css: l.innerHTML });
      });
      const r = t.excludeInlineStyles ? (a = t.elements) != null ? a : [] : void 0, s = Mf(r);
      return yield Ff([...n, ...s]);
    });
  }
  const Bf = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let co = (t = 21) => {
    let e = "", n = crypto.getRandomValues(new Uint8Array(t |= 0));
    for (; t--; )
      e += Bf[n[t] & 63];
    return e;
  };
  const uo = "--pa-cascade-property", ho = "data-anchor-position-wrapper", fo = "data-pa-wrapper-for-", yr = "POLYFILL-POSITION-AREA", Uf = [
    "left",
    "center",
    "right",
    "span-left",
    "span-right",
    "x-start",
    "x-end",
    "span-x-start",
    "span-x-end",
    "self-x-start",
    "self-x-end",
    "span-self-x-start",
    "span-self-x-end",
    "span-all",
    "top",
    "bottom",
    "span-top",
    "span-bottom",
    "y-start",
    "y-end",
    "span-y-start",
    "span-y-end",
    "self-y-start",
    "self-y-end",
    "span-self-y-start",
    "span-self-y-end",
    "block-start",
    "block-end",
    "span-block-start",
    "span-block-end",
    "inline-start",
    "inline-end",
    "span-inline-start",
    "span-inline-end",
    "self-block-start",
    "self-block-end",
    "span-self-block-start",
    "span-self-block-end",
    "self-inline-start",
    "self-inline-end",
    "span-self-inline-start",
    "span-self-inline-end",
    "start",
    "end",
    "span-start",
    "span-end",
    "self-start",
    "self-end",
    "span-self-start",
    "span-self-end"
  ];
  function po(t) {
    return Uf.includes(t);
  }
  const br = {
    left: [
      0,
      1,
      "Irrelevant"
      /* Irrelevant */
    ],
    center: [
      1,
      2,
      "Irrelevant"
      /* Irrelevant */
    ],
    right: [
      2,
      3,
      "Irrelevant"
      /* Irrelevant */
    ],
    "span-left": [
      0,
      2,
      "Irrelevant"
      /* Irrelevant */
    ],
    "span-right": [
      1,
      3,
      "Irrelevant"
      /* Irrelevant */
    ],
    "x-start": [
      0,
      1,
      "Physical"
      /* Physical */
    ],
    "x-end": [
      2,
      3,
      "Physical"
      /* Physical */
    ],
    "span-x-start": [
      0,
      2,
      "Physical"
      /* Physical */
    ],
    "span-x-end": [
      1,
      3,
      "Physical"
      /* Physical */
    ],
    "self-x-start": [
      0,
      1,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "self-x-end": [
      2,
      3,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "span-self-x-start": [
      0,
      2,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "span-self-x-end": [
      1,
      3,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "span-all": [
      0,
      3,
      "Irrelevant"
      /* Irrelevant */
    ],
    top: [
      0,
      1,
      "Irrelevant"
      /* Irrelevant */
    ],
    bottom: [
      2,
      3,
      "Irrelevant"
      /* Irrelevant */
    ],
    "span-top": [
      0,
      2,
      "Irrelevant"
      /* Irrelevant */
    ],
    "span-bottom": [
      1,
      3,
      "Irrelevant"
      /* Irrelevant */
    ],
    "y-start": [
      0,
      1,
      "Physical"
      /* Physical */
    ],
    "y-end": [
      2,
      3,
      "Physical"
      /* Physical */
    ],
    "span-y-start": [
      0,
      2,
      "Physical"
      /* Physical */
    ],
    "span-y-end": [
      1,
      3,
      "Physical"
      /* Physical */
    ],
    "self-y-start": [
      0,
      1,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "self-y-end": [
      2,
      3,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "span-self-y-start": [
      0,
      2,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "span-self-y-end": [
      1,
      3,
      "PhysicalSelf"
      /* PhysicalSelf */
    ],
    "block-start": [
      0,
      1,
      "Logical"
      /* Logical */
    ],
    "block-end": [
      2,
      3,
      "Logical"
      /* Logical */
    ],
    "span-block-start": [
      0,
      2,
      "Logical"
      /* Logical */
    ],
    "span-block-end": [
      1,
      3,
      "Logical"
      /* Logical */
    ],
    "inline-start": [
      0,
      1,
      "Logical"
      /* Logical */
    ],
    "inline-end": [
      2,
      3,
      "Logical"
      /* Logical */
    ],
    "span-inline-start": [
      0,
      2,
      "Logical"
      /* Logical */
    ],
    "span-inline-end": [
      1,
      3,
      "Logical"
      /* Logical */
    ],
    "self-block-start": [
      0,
      1,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "self-block-end": [
      2,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-block-start": [
      0,
      2,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-block-end": [
      1,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "self-inline-start": [
      0,
      1,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "self-inline-end": [
      2,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-inline-start": [
      0,
      2,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-inline-end": [
      1,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    start: [
      0,
      1,
      "Logical"
      /* Logical */
    ],
    end: [
      2,
      3,
      "Logical"
      /* Logical */
    ],
    "span-start": [
      0,
      2,
      "Logical"
      /* Logical */
    ],
    "span-end": [
      1,
      3,
      "Logical"
      /* Logical */
    ],
    "self-start": [
      0,
      1,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "self-end": [
      2,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-start": [
      0,
      2,
      "LogicalSelf"
      /* LogicalSelf */
    ],
    "span-self-end": [
      1,
      3,
      "LogicalSelf"
      /* LogicalSelf */
    ]
  }, Wf = [
    "left",
    "center",
    "right",
    "span-left",
    "span-right",
    "x-start",
    "x-end",
    "span-x-start",
    "span-x-end",
    "self-x-start",
    "self-x-end",
    "span-self-x-start",
    "span-self-x-end",
    "span-all"
  ], zf = [
    "top",
    "center",
    "bottom",
    "span-top",
    "span-bottom",
    "y-start",
    "y-end",
    "span-y-start",
    "span-y-end",
    "self-y-start",
    "self-y-end",
    "span-self-y-start",
    "span-self-y-end",
    "span-all"
  ], Hf = [
    "block-start",
    "center",
    "block-end",
    "span-block-start",
    "span-block-end",
    "span-all"
  ], Vf = [
    "inline-start",
    "center",
    "inline-end",
    "span-inline-start",
    "span-inline-end",
    "span-all"
  ], Gf = [
    "self-block-start",
    "center",
    "self-block-end",
    "span-self-block-start",
    "span-self-block-end",
    "span-all"
  ], qf = [
    "self-inline-start",
    "center",
    "self-inline-end",
    "span-self-inline-start",
    "span-self-inline-end",
    "span-all"
  ], xr = [
    "start",
    "center",
    "end",
    "span-start",
    "span-end",
    "span-all"
  ], Cr = [
    "self-start",
    "center",
    "self-end",
    "span-self-start",
    "span-self-end",
    "span-all"
  ], Kf = ["block", "top", "bottom", "y"], Qf = ["inline", "left", "right", "x"];
  function gn(t) {
    const e = t.split("-");
    for (const n of e) {
      if (Kf.includes(n)) return "block";
      if (Qf.includes(n)) return "inline";
    }
    return "ambiguous";
  }
  function Yf(t, e) {
    return e[0].includes(t[0]) && e[1].includes(t[1]) || e[0].includes(t[1]) && e[1].includes(t[0]);
  }
  const Xf = [
    [Wf, zf],
    [Hf, Vf],
    [Gf, qf],
    [xr, xr],
    [Cr, Cr]
  ];
  function Jf(t) {
    for (const e of Xf)
      if (Yf(t, e)) return !0;
    return !1;
  }
  const wr = (t) => {
    const e = getComputedStyle(t);
    return {
      writingMode: e.writingMode,
      direction: e.direction
    };
  }, Zf = (t, e) => R(null, null, function* () {
    const n = yield En(t);
    switch (e) {
      case "Logical":
      case "Physical":
        return wr(n);
      case "LogicalSelf":
      case "PhysicalSelf":
        return wr(t);
      default:
        return null;
    }
  }), tn = (t) => t.reverse().map((e) => 3 - e), go = (t, e) => t === "Irrelevant" ? e : t, tp = (r, s) => R(null, [r, s], function* ({
    block: t,
    inline: e
  }, n) {
    const o = go(t[2], e[2]), a = yield Zf(n, o), l = {
      block: [t[0], t[1]],
      inline: [e[0], e[1]]
    };
    if (a) {
      if (a.direction === "rtl" && (l.inline = tn(l.inline)), a.writingMode.startsWith("vertical")) {
        const u = l.block;
        l.block = l.inline, l.inline = u;
      }
      if (a.writingMode.startsWith("sideways")) {
        const u = l.block;
        l.block = l.inline, l.inline = u, a.writingMode.endsWith("lr") && (l.block = tn(l.block));
      }
      a.writingMode.endsWith("rl") && (l.inline = tn(l.inline));
    }
    return l;
  }), ep = ({
    block: t,
    inline: e
  }) => {
    const n = [0, "top", "bottom", 0], r = [0, "left", "right", 0];
    return {
      block: [n[t[0]], n[t[1]]],
      inline: [r[e[0]], r[e[1]]]
    };
  };
  function Ar([t, e]) {
    return t === 0 && e === 3 ? "center" : t === 0 ? "end" : e === 3 ? "start" : "center";
  }
  function np(t) {
    return t.type === "Declaration" && t.property === "position-area";
  }
  function rp(t) {
    const e = t.value.children.toArray().map(({ name: n }) => n);
    return e.length === 1 && (gn(e[0]) === "ambiguous" ? e.push(e[0]) : e.push("span-all")), e;
  }
  function sp(t) {
    if (!np(t)) return;
    const e = rp(t);
    if (!Jf(e)) return;
    const n = {};
    switch (gn(e[0])) {
      case "block":
        n.block = e[0], n.inline = e[1];
        break;
      case "inline":
        n.inline = e[0], n.block = e[1];
        break;
      case "ambiguous":
        gn(e[1]) == "block" ? (n.block = e[1], n.inline = e[0]) : (n.inline = e[1], n.block = e[0]);
        break;
    }
    const r = {
      block: br[n.block],
      inline: br[n.inline]
    }, s = `--pa-declaration-${co(12)}`;
    return {
      values: n,
      grid: r,
      selectorUUID: s
    };
  }
  function ip(t, e) {
    [
      // Insets are applied to a wrapping element
      "justify-self",
      "align-self"
    ].forEach((n) => {
      e.children.appendData({
        type: "Declaration",
        property: n,
        value: { type: "Raw", value: `var(--pa-value-${n})` },
        important: !1
      });
    }), e.children.appendData({
      type: "Declaration",
      property: uo,
      value: { type: "Raw", value: t.selectorUUID },
      important: !1
    });
  }
  function op(t, e) {
    var r, s;
    let n;
    if (((r = t.parentElement) == null ? void 0 : r.tagName) === yr)
      n = t.parentElement;
    else {
      n = document.createElement(yr), n.style.display = "grid", n.style.position = "absolute";
      const o = getComputedStyle(t).pointerEvents;
      n.style.pointerEvents = "none", t.style.pointerEvents = o, ["top", "left", "right", "bottom"].forEach((a) => {
        n.style.setProperty(a, `var(--pa-value-${a})`);
      }), (s = t.parentElement) == null || s.insertBefore(n, t), n.appendChild(t);
    }
    return n.setAttribute(
      `${fo}${e}`,
      ""
    ), n;
  }
  function ap(t, e, n) {
    return R(this, null, function* () {
      const r = `--pa-target-${co(12)}`, s = yield tp(
        e.grid,
        t
      ), o = ep(s), a = go(
        e.grid.block[2],
        e.grid.inline[2]
      ), l = [
        "LogicalSelf",
        "PhysicalSelf"
        /* PhysicalSelf */
      ].includes(a) ? s : e.grid, u = {
        block: Ar([l.block[0], l.block[1]]),
        inline: Ar([
          l.inline[0],
          l.inline[1]
        ])
      };
      return {
        insets: o,
        alignments: u,
        targetUUID: r,
        targetEl: t,
        anchorEl: n,
        wrapperEl: op(t, r),
        values: e.values,
        grid: e.grid,
        selectorUUID: e.selectorUUID
      };
    });
  }
  function lp(t, e) {
    return `
    [${ho}="${e}"][${fo}${t}] {
      --pa-value-top: var(${t}-top);
      --pa-value-left: var(${t}-left);
      --pa-value-right: var(${t}-right);
      --pa-value-bottom: var(${t}-bottom);
      --pa-value-justify-self: var(${t}-justify-self);
      --pa-value-align-self: var(${t}-align-self);
    }
  `.replaceAll(`
`, "");
  }
  const cp = [
    "normal",
    "most-width",
    "most-height",
    "most-block-size",
    "most-inline-size"
  ], up = [
    "flip-block",
    "flip-inline",
    "flip-start"
  ];
  function hp(t) {
    return t.type === "Declaration";
  }
  function fp(t) {
    return t.type === "Declaration" && t.property === "position-try-fallbacks";
  }
  function pp(t) {
    return t.type === "Declaration" && t.property === "position-try-order";
  }
  function dp(t) {
    return t.type === "Declaration" && t.property === "position-try";
  }
  function gp(t) {
    return t.type === "Atrule" && t.name === "position-try";
  }
  function mp(t) {
    return up.includes(t);
  }
  function kp(t) {
    return cp.includes(t);
  }
  function Sp(t, e) {
    const n = document.querySelector(t);
    if (n) {
      let r = bp(n);
      return e.forEach((s) => {
        r = mo(r, s);
      }), r;
    }
  }
  function yp(t, e) {
    let n = t.declarations;
    return e.forEach((r) => {
      n = mo(n, r);
    }), n;
  }
  function bp(t) {
    const e = {};
    return Zi.forEach((n) => {
      const r = ot(t, `--${n}-${oo}`);
      r && (e[n] = r);
    }), e;
  }
  const xp = {
    "flip-block": {
      top: "bottom",
      bottom: "top",
      "inset-block-start": "inset-block-end",
      "inset-block-end": "inset-block-start",
      "margin-top": "margin-bottom",
      "margin-bottom": "margin-top"
    },
    "flip-inline": {
      left: "right",
      right: "left",
      "inset-inline-start": "inset-inline-end",
      "inset-inline-end": "inset-inline-start",
      "margin-left": "margin-right",
      "margin-right": "margin-left"
    },
    "flip-start": {
      left: "top",
      right: "bottom",
      top: "left",
      bottom: "right",
      "inset-block-start": "inset-block-end",
      "inset-block-end": "inset-block-start",
      "inset-inline-start": "inset-inline-end",
      "inset-inline-end": "inset-inline-start",
      "inset-block": "inset-inline",
      "inset-inline": "inset-block"
    }
  }, Cp = {
    "flip-block": {
      top: "bottom",
      bottom: "top",
      start: "end",
      end: "start",
      "self-end": "self-start",
      "self-start": "self-end"
    },
    "flip-inline": {
      left: "right",
      right: "left",
      start: "end",
      end: "start",
      "self-end": "self-start",
      "self-start": "self-end"
    },
    "flip-start": {
      top: "left",
      left: "top",
      right: "bottom",
      bottom: "right"
    }
  }, wp = {
    "flip-block": {
      top: "bottom",
      bottom: "top",
      start: "end",
      end: "start"
    },
    "flip-inline": {
      left: "right",
      right: "left",
      start: "end",
      end: "start"
    },
    "flip-start": {
      // TODO: Requires fuller logic
    }
  };
  function Ap(t, e) {
    return xp[e][t] || t;
  }
  function Tp(t, e) {
    return Cp[e][t] || t;
  }
  function vp(t, e) {
    if (e === "flip-start")
      return t;
    {
      const n = wp[e];
      return t.split("-").map((r) => n[r] || r).join("-");
    }
  }
  function Ep(t, e, n) {
    if (t === "margin") {
      const [r, s, o, a] = e.children.toArray();
      n === "flip-block" ? a ? e.children.fromArray([o, s, r, a]) : o && e.children.fromArray([o, s, r]) : n === "flip-inline" && a && e.children.fromArray([r, a, o, s]);
    } else if (t === "margin-block") {
      const [r, s] = e.children.toArray();
      n === "flip-block" && s && e.children.fromArray([s, r]);
    } else if (t === "margin-inline") {
      const [r, s] = e.children.toArray();
      n === "flip-inline" && s && e.children.fromArray([s, r]);
    }
  }
  const $p = (t, e) => {
    var s;
    return ((s = Ot(`#id{${t}: ${e};}`).children.first) == null ? void 0 : s.block.children.first).value;
  };
  function mo(t, e) {
    const n = {};
    return Object.entries(t).forEach(([r, s]) => {
      var u;
      const o = r, a = $p(o, s), l = Ap(o, e);
      l !== o && ((u = n[o]) != null || (n[o] = "revert")), $t(a, {
        visit: "Function",
        enter(i) {
          Re(i) && i.children.forEach((c) => {
            oe(c) && eo(c.name) && (c.name = Tp(c.name, e));
          });
        }
      }), o === "position-area" && a.children.forEach((i) => {
        oe(i) && po(i.name) && (i.name = vp(i.name, e));
      }), o.startsWith("margin") && Ep(o, a, e), n[l] = Z(a);
    }), n;
  }
  function ko(t) {
    const e = wf(t), n = [];
    return e.forEach((r) => {
      const s = {
        atRules: [],
        tactics: [],
        positionAreas: []
      };
      r.forEach((o) => {
        mp(o.name) ? s.tactics.push(o.name) : o.name.startsWith("--") ? s.atRules.push(o.name) : po(o.name) && s.positionAreas.push(o.name);
      }), s.positionAreas.length ? n.push({
        positionArea: s.positionAreas[0],
        type: "position-area"
      }) : s.atRules.length && s.tactics.length ? n.push({
        tactics: s.tactics,
        atRule: s.atRules[0],
        type: "at-rule-with-try-tactic"
      }) : s.atRules.length ? n.push({
        atRule: s.atRules[0],
        type: "at-rule"
      }) : s.tactics.length && n.push({
        tactics: s.tactics,
        type: "try-tactic"
      });
    }), n;
  }
  function Op(t) {
    return fp(t) && t.value.children.first ? ko(t.value.children) : [];
  }
  function Lp(t) {
    if (dp(t) && t.value.children.first) {
      const e = Ee(t);
      let n;
      const r = e.value.children.first.name;
      r && kp(r) && (n = r, e.value.children.shift());
      const s = ko(e.value.children);
      return { order: n, options: s };
    }
    return {};
  }
  function Pp(t) {
    return pp(t) && t.value.children.first ? {
      order: t.value.children.first.name
    } : {};
  }
  function Rp(t) {
    const { order: e, options: n } = Lp(t);
    if (e || n)
      return { order: e, options: n };
    const { order: r } = Pp(t), s = Op(t);
    return r || s ? { order: r, options: s } : {};
  }
  function Ip(t) {
    return ue(t.property) || uh(t.property) || Xi(t.property) || hh(t.property) || ["position-anchor", "position-area"].includes(t.property);
  }
  function _p(t) {
    var e, n;
    if (gp(t) && ((e = t.prelude) != null && e.value) && ((n = t.block) != null && n.children)) {
      const r = t.prelude.value, s = t.block.children.filter(
        (a) => hp(a) && Ip(a)
      ), o = {
        uuid: `${r}-try-${lt(12)}`,
        declarations: Object.fromEntries(
          s.map((a) => [a.property, Z(a.value)])
        )
      };
      return { name: r, tryBlock: o };
    }
    return {};
  }
  function Np(t) {
    const e = {}, n = {}, r = {};
    for (const s of t) {
      const o = Ot(s.css);
      $t(o, {
        visit: "Atrule",
        enter(a) {
          const { name: l, tryBlock: u } = _p(a);
          l && u && (e[l] = u);
        }
      });
    }
    for (const s of t) {
      let o = !1;
      const a = /* @__PURE__ */ new Set(), l = Ot(s.css);
      $t(l, {
        visit: "Declaration",
        enter(u) {
          var g;
          const i = (g = this.rule) == null ? void 0 : g.prelude, c = pn(i);
          if (!c.length) return;
          const { order: h, options: f } = Rp(u), p = {};
          h && (p.order = h), c.forEach(({ selector: m }) => {
            var k, S;
            f == null || f.forEach((x) => {
              var M, et, w;
              let T;
              if (x.type === "at-rule")
                T = x.atRule;
              else if (x.type === "try-tactic") {
                T = `${m}-${x.tactics.join("-")}`;
                const C = Sp(
                  m,
                  x.tactics
                );
                C && (e[T] = {
                  uuid: `${m}-${x.tactics.join("-")}-try-${lt(12)}`,
                  declarations: C
                });
              } else if (x.type === "at-rule-with-try-tactic") {
                T = `${m}-${x.atRule}-${x.tactics.join("-")}`;
                const C = e[x.atRule], P = yp(
                  C,
                  x.tactics
                );
                P && (e[T] = {
                  uuid: `${m}-${x.atRule}-${x.tactics.join("-")}-try-${lt(12)}`,
                  declarations: P
                });
              }
              if (T && e[T]) {
                const C = `[data-anchor-polyfill="${e[T].uuid}"]`;
                (M = n[C]) != null || (n[C] = []), n[C].push(m), a.has(T) || ((et = p.fallbacks) != null || (p.fallbacks = []), p.fallbacks.push(e[T]), a.add(T), (w = this.stylesheet) == null || w.children.prependData({
                  type: "Rule",
                  prelude: {
                    type: "Raw",
                    value: C
                  },
                  block: {
                    type: "Block",
                    children: new q().fromArray(
                      Object.entries(e[T].declarations).map(
                        ([P, L]) => ({
                          type: "Declaration",
                          important: !0,
                          property: P,
                          value: {
                            type: "Raw",
                            value: L
                          }
                        })
                      )
                    )
                  }
                }), o = !0);
              }
            }), Object.keys(p).length > 0 && (r[m] ? (p.order && (r[m].order = p.order), p.fallbacks && ((S = (k = r[m]).fallbacks) != null || (k.fallbacks = []), r[m].fallbacks.push(
              ...p.fallbacks
            ))) : r[m] = p);
          });
        }
      }), o && (s.css = Z(l), s.changed = !0);
    }
    return { fallbackTargets: n, validPositions: r };
  }
  function Dp(t, e) {
    return !t || t === e ? !1 : So(t) ? t.document.contains(e) : t.contains(e);
  }
  function So(t) {
    return !!(t && t === t.window);
  }
  function Fp(t) {
    return Zt(t, "position", "fixed");
  }
  function mn(t) {
    return !!(t && (Fp(t) || Zt(t, "position", "absolute")));
  }
  function Tr(t, e) {
    return t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING;
  }
  function Mp(t) {
    return R(this, null, function* () {
      return yield H.getOffsetParent(t);
    });
  }
  function en(t) {
    return R(this, null, function* () {
      if (!["absolute", "fixed"].includes(ot(t, "position")))
        return yield Mp(t);
      let e = t.parentElement;
      for (; e; ) {
        if (!Zt(e, "position", "static") && Zt(e, "display", "block"))
          return e;
        e = e.parentElement;
      }
      return window;
    });
  }
  function jp(t, e, n, r) {
    return R(this, null, function* () {
      const s = yield en(t), o = yield en(n);
      if (!(Dp(o, t) || So(o)) || s === o && !(!mn(t) || Tr(t, n)))
        return !1;
      if (s !== o) {
        let a;
        const l = [];
        for (a = s; a && a !== o && a !== window; )
          l.push(a), a = yield en(a);
        const u = l[l.length - 1];
        if (u instanceof HTMLElement && !(!mn(u) || Tr(u, n)))
          return !1;
      }
      {
        let a = t.parentElement;
        for (; a; ) {
          if (Zt(a, "content-visibility", "hidden"))
            return !1;
          a = a.parentElement;
        }
      }
      return !(e && r && vr(t, e, r) !== vr(n, e, r));
    });
  }
  function vr(t, e, n) {
    for (; !(t.matches(n) && _f(t, e)); ) {
      if (!t.parentElement)
        return null;
      t = t.parentElement;
    }
    return t;
  }
  function Bp(t, e, n, r, s) {
    return R(this, null, function* () {
      if (!(t instanceof HTMLElement && n.length && mn(t)))
        return null;
      const o = n.flatMap((l) => Rf(l, s)).filter((l) => If(l, e)), a = r.map((l) => l.selector).join(",") || null;
      for (let l = o.length - 1; l >= 0; l--) {
        const u = o[l], i = "fakePseudoElement" in u;
        if (yield jp(
          i ? u.fakePseudoElement : u,
          e,
          t,
          a
        ))
          return i && u.removeFakePseudoElement(), u;
      }
      return null;
    });
  }
  function Up(t) {
    return t.type === "Declaration" && t.property === "anchor-name";
  }
  function Wp(t) {
    return t.type === "Declaration" && t.property === "anchor-scope";
  }
  function kn(t) {
    return !!(t && t.type === "Function" && t.name === "anchor-size");
  }
  function Ae(t) {
    return !!(t && t.type === "Function" && t.name === "var");
  }
  function oe(t) {
    return !!(t.type === "Identifier" && t.name);
  }
  function zp(t) {
    return !!(t.type === "Percentage" && t.value);
  }
  function Er(t, e) {
    let n, r, s, o = "", a = !1, l;
    const u = [];
    t.children.toArray().forEach((f) => {
      if (a) {
        o = `${o}${Z(f)}`;
        return;
      }
      if (f.type === "Operator" && f.value === ",") {
        a = !0;
        return;
      }
      u.push(f);
    });
    let [i, c] = u;
    if (c || (c = i, i = void 0), i && (oe(i) && i.name.startsWith("--") ? n = i.name : Ae(i) && i.children.first && (l = i.children.first.name)), c)
      if (Re(t)) {
        if (oe(c) && eo(c.name))
          r = c.name;
        else if (zp(c)) {
          const f = Number(c.value);
          r = Number.isNaN(f) ? void 0 : f;
        }
      } else kn(t) && oe(c) && gh(c.name) && (s = c.name);
    const h = `--anchor-${lt(12)}`;
    return Object.assign(t, {
      type: "Raw",
      value: `var(${h})`,
      children: null
    }), Reflect.deleteProperty(t, "name"), {
      anchorName: n,
      anchorSide: r,
      anchorSize: s,
      fallbackValue: o,
      customPropName: l,
      uuid: h
    };
  }
  function $r(t) {
    return t.value.children.map(({ name: e }) => e);
  }
  let Vt = {}, Et = {}, Nt = {}, ae = {}, _t = {};
  function Hp() {
    Vt = {}, Et = {}, Nt = {}, ae = {}, _t = {};
  }
  function Vp(t, e) {
    var n;
    if ((Re(t) || kn(t)) && e) {
      if (e.property.startsWith("--")) {
        const r = Z(e.value), s = Er(t);
        return ae[s.uuid] = r, Nt[e.property] = [
          ...(n = Nt[e.property]) != null ? n : [],
          s
        ], { changed: !0 };
      }
      if (Re(t) && ue(e.property) || kn(t) && to(e.property)) {
        const r = Er(t);
        return { prop: e.property, data: r, changed: !0 };
      }
    }
    return {};
  }
  function Or(t, e, n) {
    return R(this, null, function* () {
      let r = e == null ? void 0 : e.anchorName;
      const s = e == null ? void 0 : e.customPropName;
      if (t && !r) {
        const u = ot(
          t,
          "position-anchor"
        );
        u ? r = u : s && (r = ot(t, s));
      }
      const o = r ? Vt[r] || [] : [], a = r ? Et[lo.All] || [] : [], l = r ? Et[r] || [] : [];
      return yield Bp(
        t,
        r || null,
        o,
        [...a, ...l],
        { roots: n.roots }
      );
    });
  }
  function Gp(t, e) {
    return R(this, null, function* () {
      var h, f, p, g, m, k, S, x, T, M, et;
      const n = {}, r = {};
      Hp();
      const { fallbackTargets: s, validPositions: o } = Np(t);
      for (const w of t) {
        let C = !1;
        const P = Ot(w.css);
        $t(P, function(L) {
          var J, xt, Pt, Ct, pt, wt;
          const N = (J = this.rule) == null ? void 0 : J.prelude, $ = pn(N);
          if (Up(L) && $.length)
            for (const B of $r(L))
              (xt = Vt[B]) != null || (Vt[B] = []), Vt[B].push(...$);
          if (Wp(L) && $.length)
            for (const B of $r(L))
              (Pt = Et[B]) != null || (Et[B] = []), Et[B].push(...$);
          const {
            prop: v,
            data: j,
            changed: D
          } = Vp(L, this.declaration);
          if (v && j && $.length)
            for (const { selector: B } of $)
              n[B] = G(U({}, n[B]), {
                [v]: [...(pt = (Ct = n[B]) == null ? void 0 : Ct[v]) != null ? pt : [], j]
              });
          let V;
          if (this.block && (V = sp(L), V)) {
            ip(
              V,
              this.block
            );
            for (const { selector: B } of $)
              r[B] = [
                ...(wt = r[B]) != null ? wt : [],
                V
              ];
          }
          (D || V) && (C = !0);
        }), C && (w.css = Z(P), w.changed = !0);
      }
      const a = new Set(Object.keys(Nt)), l = {}, u = (w) => {
        var L, N, $, v, j;
        const C = [], P = new Set((N = (L = l[w]) == null ? void 0 : L.names) != null ? N : []);
        for (; P.size > 0; )
          for (const D of P)
            C.push(...($ = Nt[D]) != null ? $ : []), P.delete(D), (j = (v = l[D]) == null ? void 0 : v.names) != null && j.length && l[D].names.forEach((V) => P.add(V));
        return C;
      };
      for (; a.size > 0; ) {
        const w = [];
        for (const C of t) {
          let P = !1;
          const L = Ot(C.css);
          $t(L, {
            visit: "Function",
            enter(N) {
              var D, V;
              const $ = (D = this.rule) == null ? void 0 : D.prelude, v = this.declaration, j = v == null ? void 0 : v.property;
              if (($ == null ? void 0 : $.children.isEmpty) === !1 && Ae(N) && v && j && N.children.first && a.has(N.children.first.name) && // For now, we only want assignments to other CSS custom properties
              j.startsWith("--")) {
                const J = N.children.first, xt = (V = Nt[J.name]) != null ? V : [], Pt = u(J.name);
                if (!(xt.length || Pt.length))
                  return;
                const Ct = `${J.name}-anchor-${lt(12)}`, pt = Z(v.value);
                ae[Ct] = pt, l[j] || (l[j] = { names: [], uuids: [] });
                const wt = l[j];
                wt.names.includes(J.name) || wt.names.push(J.name), wt.uuids.push(Ct), w.push(j), J.name = Ct, P = !0;
              }
            }
          }), P && (C.css = Z(L), C.changed = !0);
        }
        a.clear(), w.forEach((C) => a.add(C));
      }
      for (const w of t) {
        let C = !1;
        const P = Ot(w.css);
        $t(P, {
          visit: "Function",
          enter(L) {
            var j, D, V, J, xt, Pt, Ct;
            const N = (j = this.rule) == null ? void 0 : j.prelude, $ = this.declaration, v = $ == null ? void 0 : $.property;
            if ((N == null ? void 0 : N.children.isEmpty) === !1 && Ae(L) && $ && v && L.children.first && // Now we only want assignments to inset/sizing properties
            (ue(v) || Xi(v))) {
              const pt = L.children.first, wt = (D = Nt[pt.name]) != null ? D : [], B = u(pt.name);
              if (!(wt.length || B.length))
                return;
              const pe = `${v}-${lt(12)}`;
              if (B.length) {
                const jt = /* @__PURE__ */ new Set([pt.name]);
                for (; jt.size > 0; )
                  for (const Bt of jt) {
                    const K = l[Bt];
                    if ((V = K == null ? void 0 : K.names) != null && V.length && ((J = K == null ? void 0 : K.uuids) != null && J.length))
                      for (const Ut of K.names)
                        for (const Wt of K.uuids)
                          _t[Wt] = G(U({}, _t[Wt]), {
                            // - `key` (`propUuid`) is the property-specific
                            //   uuid to append to the new custom property name
                            // - `value` is the new property-specific custom
                            //   property value to use
                            [pe]: `${Ut}-${pe}`
                          });
                    jt.delete(Bt), (xt = K == null ? void 0 : K.names) != null && xt.length && K.names.forEach((Ut) => jt.add(Ut));
                  }
              }
              const yo = pn(N);
              for (const jt of [...wt, ...B]) {
                const Bt = U({}, jt), K = `--anchor-${lt(12)}-${v}`, Ut = Bt.uuid;
                Bt.uuid = K;
                for (const { selector: Wt } of yo)
                  n[Wt] = G(U({}, n[Wt]), {
                    [v]: [...(Ct = (Pt = n[Wt]) == null ? void 0 : Pt[v]) != null ? Ct : [], Bt]
                  });
                _t[Ut] = G(U({}, _t[Ut]), {
                  // - `key` (`propUuid`) is the property-specific
                  //   uuid to append to the new custom property name
                  // - `value` is the new property-specific custom
                  //   property value to use
                  [pe]: K
                });
              }
              pt.name = `${pt.name}-${pe}`, C = !0;
            }
          }
        }), C && (w.css = Z(P), w.changed = !0);
      }
      if (Object.keys(_t).length > 0)
        for (const w of t) {
          let C = !1;
          const P = Ot(w.css);
          $t(P, {
            visit: "Function",
            enter(L) {
              var N, $, v, j;
              if (Ae(L) && (($ = (N = L.children.first) == null ? void 0 : N.name) != null && $.startsWith("--")) && ((j = (v = this.declaration) == null ? void 0 : v.property) != null && j.startsWith("--")) && this.block) {
                const D = L.children.first, V = _t[D.name];
                if (V)
                  for (const [J, xt] of Object.entries(V))
                    this.block.children.appendData({
                      type: "Declaration",
                      important: !1,
                      property: `${this.declaration.property}-${J}`,
                      value: {
                        type: "Raw",
                        value: Z(this.declaration.value).replace(
                          `var(${D.name})`,
                          `var(${xt})`
                        )
                      }
                    }), C = !0;
                ae[D.name] && (this.declaration.value = {
                  type: "Raw",
                  value: ae[D.name]
                }, C = !0);
              }
            }
          }), C && (w.css = Z(P), w.changed = !0);
        }
      const i = /* @__PURE__ */ new Map();
      for (const [w, C] of Object.entries(n)) {
        let P;
        w.startsWith("[data-anchor-polyfill=") && ((h = s[w]) != null && h.length) ? P = ie(
          e.roots,
          s[w].join(",")
        ) : P = ie(e.roots, w);
        for (const [L, N] of Object.entries(C))
          for (const $ of N)
            for (const v of P) {
              const j = yield Or(v, $, {
                roots: e.roots
              }), D = `--anchor-${lt(12)}`;
              i.set(v, G(U({}, (f = i.get(v)) != null ? f : {}), {
                [$.uuid]: D
              })), v.setAttribute(
                "style",
                `${$.uuid}: var(${D}); ${(p = v.getAttribute("style")) != null ? p : ""}`
              ), o[w] = G(U({}, o[w]), {
                declarations: G(U({}, (g = o[w]) == null ? void 0 : g.declarations), {
                  [L]: [
                    ...(S = (k = (m = o[w]) == null ? void 0 : m.declarations) == null ? void 0 : k[L]) != null ? S : [],
                    G(U({}, $), { anchorEl: j, targetEl: v, uuid: D })
                  ]
                })
              });
            }
      }
      const c = {
        el: document.createElement("link"),
        changed: !1,
        created: !0,
        css: ""
      };
      t.push(c);
      for (const [w, C] of Object.entries(r)) {
        const P = ie(e.roots, w);
        for (const L of P) {
          const N = yield Or(L, null, {
            roots: e.roots
          });
          for (const $ of C) {
            const v = yield ap(
              L,
              $,
              N
            );
            c.css += lp(
              v.targetUUID,
              $.selectorUUID
            ), c.changed = !0, o[w] = G(U({}, o[w]), {
              declarations: G(U({}, (x = o[w]) == null ? void 0 : x.declarations), {
                "position-area": [
                  ...(et = (M = (T = o[w]) == null ? void 0 : T.declarations) == null ? void 0 : M["position-area"]) != null ? et : [],
                  v
                ]
              })
            });
          }
        }
      }
      return { rules: o, inlineStyles: i, anchorScopes: Et };
    });
  }
  const qp = [
    "as",
    "blocking",
    "crossorigin",
    // 'disabled' is not relevant for style elements, but this exclusion is
    // theoretical, as a <link rel=stylesheet disabled> will not be loaded, and
    // will not reach this part of the polyfill. See #246.
    "disabled",
    "fetchpriority",
    "href",
    "hreflang",
    "integrity",
    "referrerpolicy",
    "rel",
    "type"
  ];
  function Lr(t, e, n = !1) {
    const r = [];
    for (const { el: s, css: o, changed: a, created: l = !1 } of t) {
      const u = { el: s, css: o, changed: !1 };
      if (a) {
        if (s.tagName.toLowerCase() === "style")
          s.innerHTML = o;
        else if (s instanceof HTMLLinkElement) {
          const i = document.createElement("style");
          i.textContent = o;
          for (const c of s.getAttributeNames())
            if (!c.startsWith("on") && !qp.includes(c)) {
              const h = s.getAttribute(c);
              h !== null && i.setAttribute(c, h);
            }
          s.hasAttribute("href") && i.setAttribute("data-original-href", s.getAttribute("href")), l ? (i.setAttribute("data-generated-by-polyfill", "true"), document.head.insertAdjacentElement("beforeend", i)) : (s.insertAdjacentElement("beforebegin", i), s.remove()), u.el = i;
        } else if (s.hasAttribute("data-has-inline-styles")) {
          const i = s.getAttribute("data-has-inline-styles");
          if (i) {
            const c = `[data-has-inline-styles="${i}"]{`;
            let f = o.slice(c.length, 0 - "}".length);
            const p = e == null ? void 0 : e.get(s);
            if (p)
              for (const [g, m] of Object.entries(p))
                f = `${g}: var(${m}); ${f}`;
            s.setAttribute("style", f);
          }
        }
      }
      n && s.hasAttribute("data-has-inline-styles") && s.removeAttribute("data-has-inline-styles"), r.push(u);
    }
    return r;
  }
  const Kp = G(U({}, H), { _c: /* @__PURE__ */ new Map() }), Qp = (t, e) => {
    let n;
    switch (t) {
      case "start":
      case "self-start":
        n = 0;
        break;
      case "end":
      case "self-end":
        n = 100;
        break;
      default:
        typeof t == "number" && !Number.isNaN(t) && (n = t);
    }
    if (n !== void 0)
      return e ? 100 - n : n;
  }, Yp = (t, e) => {
    let n;
    switch (t) {
      case "block":
      case "self-block":
        n = e ? "width" : "height";
        break;
      case "inline":
      case "self-inline":
        n = e ? "height" : "width";
        break;
    }
    return n;
  }, Pr = (t) => {
    switch (t) {
      case "top":
      case "bottom":
      case "inset-block-start":
      case "inset-block-end":
        return "y";
      case "left":
      case "right":
      case "inset-inline-start":
      case "inset-inline-end":
        return "x";
    }
    return null;
  }, Xp = (t) => {
    switch (t) {
      case "x":
        return "width";
      case "y":
        return "height";
    }
    return null;
  }, Rr = (t) => ot(t, "display") === "inline", Ir = (t, e) => (e === "x" ? ["border-left-width", "border-right-width"] : ["border-top-width", "border-bottom-width"]).reduce(
    (r, s) => r + parseInt(ot(t, s), 10),
    0
  ) || 0, ye = (t, e) => parseInt(ot(t, `margin-${e}`), 10) || 0, Jp = (t) => ({
    top: ye(t, "top"),
    right: ye(t, "right"),
    bottom: ye(t, "bottom"),
    left: ye(t, "left")
  }), nn = (a) => R(null, [a], function* ({
    targetEl: t,
    targetProperty: e,
    anchorRect: n,
    anchorSide: r,
    anchorSize: s,
    fallback: o = null
  }) {
    var l;
    if (!((s || r !== void 0) && t && n))
      return o;
    if (s) {
      if (!to(e))
        return o;
      let u;
      switch (s) {
        case "width":
        case "height":
          u = s;
          break;
        default: {
          let i = !1;
          const c = ot(t, "writing-mode");
          i = c.startsWith("vertical-") || c.startsWith("sideways-"), u = Yp(s, i);
        }
      }
      return u ? `${n[u]}px` : o;
    }
    if (r !== void 0) {
      let u, i;
      const c = Pr(e);
      if (!(ue(e) && c && (!ue(r) || c === Pr(r))))
        return o;
      const h = [
        "top",
        "left",
        "inset-block-start",
        "inset-inline-start"
      ], f = [
        "bottom",
        "right",
        "inset-block-end",
        "inset-inline-end"
      ];
      switch (r) {
        case "left":
        case "top":
          u = 0;
          break;
        case "right":
        case "bottom":
          u = 100;
          break;
        case "center":
          u = 50;
          break;
        case "inside":
          u = h.includes(e) ? 0 : 100;
          break;
        case "outside":
          u = h.includes(e) ? 100 : 0;
          break;
        default:
          if (t) {
            const m = (yield (l = H.isRTL) == null ? void 0 : l.call(H, t)) || !1;
            u = Qp(r, m);
          }
      }
      const p = typeof u == "number" && !Number.isNaN(u), g = Xp(c);
      if (p && g) {
        f.includes(e) && (i = yield En(t));
        let m = n[c] + n[g] * (u / 100);
        switch (e) {
          case "bottom":
          case "inset-block-end": {
            if (!i)
              break;
            let k = i.clientHeight;
            if (k === 0 && Rr(i)) {
              const S = Ir(i, c);
              k = i.offsetHeight - S;
            }
            m = k - m;
            break;
          }
          case "right":
          case "inset-inline-end": {
            if (!i)
              break;
            let k = i.clientWidth;
            if (k === 0 && Rr(i)) {
              const S = Ir(i, c);
              k = i.offsetWidth - S;
            }
            m = k - m;
            break;
          }
        }
        return `${m}px`;
      }
    }
    return o;
  }), Zp = (t) => "wrapperEl" in t, td = (t) => "uuid" in t;
  function ed(t, e = !1) {
    return R(this, null, function* () {
      const n = document.documentElement;
      for (const [r, s] of Object.entries(t))
        for (const o of s) {
          const a = o.anchorEl, l = o.targetEl;
          if (a && l)
            if (Zp(o)) {
              const u = o.wrapperEl, i = (c, h, f) => R(null, null, function* () {
                return c === 0 ? "0px" : yield nn({
                  targetEl: u,
                  targetProperty: h,
                  anchorRect: f,
                  anchorSide: c
                });
              });
              on(
                a,
                u,
                () => R(null, null, function* () {
                  const c = ot(
                    l,
                    uo
                  );
                  u.setAttribute(ho, c);
                  const h = yield H.getElementRects({
                    reference: a,
                    floating: u,
                    strategy: "absolute"
                  }), f = o.insets, p = yield i(
                    f.block[0],
                    "top",
                    h.reference
                  ), g = yield i(
                    f.block[1],
                    "bottom",
                    h.reference
                  ), m = yield i(
                    f.inline[0],
                    "left",
                    h.reference
                  ), k = yield i(
                    f.inline[1],
                    "right",
                    h.reference
                  );
                  n.style.setProperty(
                    `${o.targetUUID}-top`,
                    p || null
                  ), n.style.setProperty(
                    `${o.targetUUID}-left`,
                    m || null
                  ), n.style.setProperty(
                    `${o.targetUUID}-right`,
                    k || null
                  ), n.style.setProperty(
                    `${o.targetUUID}-bottom`,
                    g || null
                  ), n.style.setProperty(
                    `${o.targetUUID}-justify-self`,
                    o.alignments.inline
                  ), n.style.setProperty(
                    `${o.targetUUID}-align-self`,
                    o.alignments.block
                  );
                }),
                { animationFrame: e }
              );
            } else
              on(
                a,
                l,
                () => R(null, null, function* () {
                  const u = yield H.getElementRects({
                    reference: a,
                    floating: l,
                    strategy: "absolute"
                  }), i = yield nn({
                    targetEl: l,
                    targetProperty: r,
                    anchorRect: u.reference,
                    anchorSide: o.anchorSide,
                    anchorSize: o.anchorSize,
                    fallback: o.fallbackValue
                  });
                  n.style.setProperty(o.uuid, i);
                }),
                { animationFrame: e }
              );
          else if (td(o)) {
            const u = yield nn({
              targetProperty: r,
              anchorSide: o.anchorSide,
              anchorSize: o.anchorSize,
              fallback: o.fallbackValue
            });
            n.style.setProperty(o.uuid, u);
          }
        }
    });
  }
  function _r(t, e) {
    return R(this, null, function* () {
      const n = yield H.getElementRects({
        reference: t,
        floating: t,
        strategy: "absolute"
      });
      return yield ta(
        {
          x: t.offsetLeft,
          y: t.offsetTop,
          platform: Kp,
          rects: n,
          elements: {
            floating: t,
            reference: e
          },
          strategy: "absolute"
        },
        {
          padding: Jp(t)
        }
      );
    });
  }
  function nd(t, e, n = !1) {
    return R(this, null, function* () {
      if (!e.length)
        return;
      const r = document.querySelectorAll(t);
      for (const s of r) {
        let o = !1;
        const a = yield En(s);
        on(
          // We're just checking whether the target element overflows, so we don't
          // care about the position of the anchor element in this case. Passing in
          // an empty object instead of a reference element avoids unnecessarily
          // watching for irrelevant changes.
          {},
          s,
          () => R(null, null, function* () {
            if (o)
              return;
            o = !0, s.removeAttribute("data-anchor-polyfill");
            const l = yield _r(s, a);
            if (Object.values(l).every((u) => u <= 0)) {
              s.removeAttribute("data-anchor-polyfill-last-successful"), o = !1;
              return;
            }
            for (const [u, { uuid: i }] of e.entries()) {
              s.setAttribute("data-anchor-polyfill", i);
              const c = yield _r(s, a);
              if (Object.values(c).every((h) => h <= 0)) {
                s.setAttribute("data-anchor-polyfill-last-successful", i), o = !1;
                break;
              }
              if (u === e.length - 1) {
                const h = s.getAttribute(
                  "data-anchor-polyfill-last-successful"
                );
                h ? s.setAttribute("data-anchor-polyfill", h) : s.removeAttribute("data-anchor-polyfill"), o = !1;
                break;
              }
            }
          }),
          { animationFrame: n, layoutShift: !1 }
        );
      }
    });
  }
  function rd(t, e = !1) {
    return R(this, null, function* () {
      var n, r;
      for (const s of Object.values(t))
        yield ed((n = s.declarations) != null ? n : {}, e);
      for (const [s, o] of Object.entries(t))
        yield nd(
          s,
          (r = o.fallbacks) != null ? r : [],
          e
        );
    });
  }
  function sd(t = {}) {
    const e = typeof t == "boolean" ? { useAnimationFrame: t } : t, n = e.useAnimationFrame === void 0 ? !!window.UPDATE_ANCHOR_ON_ANIMATION_FRAME : e.useAnimationFrame;
    return Array.isArray(e.elements) || (e.elements = void 0), (!Array.isArray(e.roots) || e.roots.length === 0) && (e.roots = [document]), Object.assign(e, {
      useAnimationFrame: n
    });
  }
  function Nr(t) {
    return R(this, null, function* () {
      const e = sd(
        window.ANCHOR_POSITIONING_POLYFILL_OPTIONS
      );
      let n = yield jf(e), r = {}, s;
      Tf();
      try {
        $f(n) && (n = Lr(n));
        const a = yield Gp(n, { roots: e.roots });
        r = a.rules, s = a.inlineStyles;
      } catch (o) {
        throw Af(), o;
      }
      return Object.values(r).length && (Lr(n, s, !0), yield rd(r, e.useAnimationFrame)), r;
    });
  }
  document.readyState !== "complete" ? window.addEventListener("load", () => {
    Nr();
  }) : Nr();
});
export default id();
//# sourceMappingURL=css-anchor-positioning.js.map
