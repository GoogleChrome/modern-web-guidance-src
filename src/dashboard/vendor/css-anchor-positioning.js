// @ts-nocheck -- third-party vendored code; excluded from the dashboard type check.
/*! @oddbird/css-anchor-positioning@0.10.2 | Copyright (c) 2022–2026 OddBird LLC | BSD-3-Clause License (see vendor/README.md)
 * Vendored from https://unpkg.com/@oddbird/css-anchor-positioning@0.10.2/dist/css-anchor-positioning.js
 */
//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, n = Math.min, r = Math.max, i = Math.round, a = Math.floor, o = (e) => ({
	x: e,
	y: e
});
function s(e) {
	let { x: t, y: n, width: r, height: i } = e;
	return {
		width: r,
		height: i,
		top: n,
		left: t,
		right: t + r,
		bottom: n + i,
		x: t,
		y: n
	};
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/asyncToGenerator.js
function c(e, t, n, r, i, a, o) {
	try {
		var s = e[a](o), c = s.value;
	} catch (e) {
		n(e);
		return;
	}
	s.done ? t(c) : Promise.resolve(c).then(r, i);
}
function l(e) {
	return function() {
		var t = this, n = arguments;
		return new Promise(function(r, i) {
			var a = e.apply(t, n);
			function o(e) {
				c(a, r, i, o, s, "next", e);
			}
			function s(e) {
				c(a, r, i, o, s, "throw", e);
			}
			o(void 0);
		});
	};
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/typeof.js
function u(e) {
	"@babel/helpers - typeof";
	return u = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, u(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/toPrimitive.js
function d(e, t) {
	if (u(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (u(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/toPropertyKey.js
function f(e) {
	var t = d(e, "string");
	return u(t) == "symbol" ? t : t + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/defineProperty.js
function p(e, t, n) {
	return (t = f(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/objectSpread2.js
function m(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function h(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? m(Object(n), !0).forEach(function(t) {
			p(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : m(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
//#endregion
//#region node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function g() {
	return typeof window < "u";
}
function _(e) {
	return ee(e) ? (e.nodeName || "").toLowerCase() : "#document";
}
function v(e) {
	var t;
	return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window;
}
function y(e) {
	var t;
	return (t = (ee(e) ? e.ownerDocument : e.document) || window.document) == null ? void 0 : t.documentElement;
}
function ee(e) {
	return g() ? e instanceof Node || e instanceof v(e).Node : !1;
}
function b(e) {
	return g() ? e instanceof Element || e instanceof v(e).Element : !1;
}
function x(e) {
	return g() ? e instanceof HTMLElement || e instanceof v(e).HTMLElement : !1;
}
function te(e) {
	return !g() || typeof ShadowRoot > "u" ? !1 : e instanceof ShadowRoot || e instanceof v(e).ShadowRoot;
}
function S(e) {
	let { overflow: t, overflowX: n, overflowY: r, display: i } = w(e);
	return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && i !== "inline" && i !== "contents";
}
function ne(e) {
	return /^(table|td|th)$/.test(_(e));
}
function re(e) {
	try {
		if (e.matches(":popover-open")) return !0;
	} catch (e) {}
	try {
		return e.matches(":modal");
	} catch (e) {
		return !1;
	}
}
var ie = /transform|translate|scale|rotate|perspective|filter/, ae = /paint|layout|strict|content/, C = (e) => !!e && e !== "none", oe;
function se(e) {
	let t = b(e) ? w(e) : e;
	return C(t.transform) || C(t.translate) || C(t.scale) || C(t.rotate) || C(t.perspective) || !le() && (C(t.backdropFilter) || C(t.filter)) || ie.test(t.willChange || "") || ae.test(t.contain || "");
}
function ce(e) {
	let t = T(e);
	for (; x(t) && !ue(t);) {
		if (se(t)) return t;
		if (re(t)) return null;
		t = T(t);
	}
	return null;
}
function le() {
	return oe == null && (oe = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), oe;
}
function ue(e) {
	return /^(html|body|#document)$/.test(_(e));
}
function w(e) {
	return v(e).getComputedStyle(e);
}
function de(e) {
	return b(e) ? {
		scrollLeft: e.scrollLeft,
		scrollTop: e.scrollTop
	} : {
		scrollLeft: e.scrollX,
		scrollTop: e.scrollY
	};
}
function T(e) {
	if (_(e) === "html") return e;
	let t = e.assignedSlot || e.parentNode || te(e) && e.host || y(e);
	return te(t) ? t.host : t;
}
function fe(e) {
	let t = T(e);
	return ue(t) ? (e.ownerDocument || e).body : x(t) && S(t) ? t : fe(t);
}
function pe(e, t, n) {
	var r;
	t === void 0 && (t = []), n === void 0 && (n = !0);
	let i = fe(e), a = i === ((r = e.ownerDocument) == null ? void 0 : r.body), o = v(i);
	if (a) {
		let e = me(o);
		return t.concat(o, o.visualViewport || [], S(i) ? i : [], e && n ? pe(e) : []);
	}
	return t.concat(i, pe(i, [], n));
}
function me(e) {
	return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
}
//#endregion
//#region node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function he(e) {
	let t = w(e), n = parseFloat(t.width) || 0, r = parseFloat(t.height) || 0, a = x(e), o = a ? e.offsetWidth : n, s = a ? e.offsetHeight : r, c = i(n) !== o || i(r) !== s;
	return c && (n = o, r = s), {
		width: n,
		height: r,
		$: c
	};
}
function ge(e) {
	return b(e) ? e : e.contextElement;
}
function _e(e) {
	let t = ge(e);
	if (!x(t)) return o(1);
	let n = t.getBoundingClientRect(), { width: r, height: a, $: s } = he(t), c = (s ? i(n.width) : n.width) / r, l = (s ? i(n.height) : n.height) / a;
	return (!c || !Number.isFinite(c)) && (c = 1), (!l || !Number.isFinite(l)) && (l = 1), {
		x: c,
		y: l
	};
}
var ve = /*#__PURE__*/ o(0);
function ye(e) {
	let t = v(e);
	return !le() || !t.visualViewport ? ve : {
		x: t.visualViewport.offsetLeft,
		y: t.visualViewport.offsetTop
	};
}
function be(e, t, n) {
	return t === void 0 && (t = !1), !!n && t && n === v(e);
}
function E(e, t, n, r) {
	t === void 0 && (t = !1), n === void 0 && (n = !1);
	let i = e.getBoundingClientRect(), a = ge(e), c = o(1);
	t && (r ? b(r) && (c = _e(r)) : c = _e(e));
	let l = be(a, n, r) ? ye(a) : o(0), u = (i.left + l.x) / c.x, d = (i.top + l.y) / c.y, f = i.width / c.x, p = i.height / c.y;
	if (a && r) {
		let e = v(a), t = b(r) ? v(r) : r, n = e, i = me(n);
		for (; i && t !== n;) {
			let e = _e(i), t = i.getBoundingClientRect(), r = w(i), a = t.left + (i.clientLeft + parseFloat(r.paddingLeft)) * e.x, o = t.top + (i.clientTop + parseFloat(r.paddingTop)) * e.y;
			u *= e.x, d *= e.y, f *= e.x, p *= e.y, u += a, d += o, n = v(i), i = me(n);
		}
	}
	return s({
		width: f,
		height: p,
		x: u,
		y: d
	});
}
function xe(e, t) {
	let n = de(e).scrollLeft;
	return t ? t.left + n : E(y(e)).left + n;
}
function Se(e, t) {
	let n = e.getBoundingClientRect();
	return {
		x: n.left + t.scrollLeft - xe(e, n),
		y: n.top + t.scrollTop
	};
}
function Ce(e) {
	let { elements: t, rect: n, offsetParent: r, strategy: i } = e, a = i === "fixed", s = y(r), c = t ? re(t.floating) : !1;
	if (r === s || c && a) return n;
	let l = {
		scrollLeft: 0,
		scrollTop: 0
	}, u = o(1), d = o(0), f = x(r);
	if ((f || !a) && ((_(r) !== "body" || S(s)) && (l = de(r)), f)) {
		let e = E(r);
		u = _e(r), d.x = e.x + r.clientLeft, d.y = e.y + r.clientTop;
	}
	let p = s && !f && !a ? Se(s, l) : o(0);
	return {
		width: n.width * u.x,
		height: n.height * u.y,
		x: n.x * u.x - l.scrollLeft * u.x + d.x + p.x,
		y: n.y * u.y - l.scrollTop * u.y + d.y + p.y
	};
}
function we(e) {
	return e.getClientRects ? Array.from(e.getClientRects()) : [];
}
function Te(e) {
	let t = de(e), n = e.ownerDocument.body, i = r(e.scrollWidth, e.clientWidth, n.scrollWidth, n.clientWidth), a = r(e.scrollHeight, e.clientHeight, n.scrollHeight, n.clientHeight), o = -t.scrollLeft + xe(e), s = -t.scrollTop;
	return w(n).direction === "rtl" && (o += r(e.clientWidth, n.clientWidth) - i), {
		width: i,
		height: a,
		x: o,
		y: s
	};
}
var Ee = 25;
function De(e, t, n) {
	n === void 0 && (n = "viewport");
	let r = n === "layoutViewport", i = v(e), a = y(e), o = i.visualViewport, s = a.clientWidth, c = a.clientHeight, l = 0, u = 0;
	if (o) {
		let e = !le() || t === "fixed";
		r ? e || (l = -o.offsetLeft, u = -o.offsetTop) : (s = o.width, c = o.height, e && (l = o.offsetLeft, u = o.offsetTop));
	}
	if (xe(a) <= 0) {
		let e = a.ownerDocument, t = e.body, n = getComputedStyle(t), r = e.compatMode === "CSS1Compat" && parseFloat(n.marginLeft) + parseFloat(n.marginRight) || 0, i = Math.abs(a.clientWidth - t.clientWidth - r), o = getComputedStyle(a).scrollbarGutter === "stable both-edges" ? i / 2 : i;
		o <= Ee && (s -= o);
	}
	return {
		width: s,
		height: c,
		x: l,
		y: u
	};
}
function Oe(e, t) {
	let n = E(e, !0, t === "fixed"), r = n.top + e.clientTop, i = n.left + e.clientLeft, a = _e(e);
	return {
		width: e.clientWidth * a.x,
		height: e.clientHeight * a.y,
		x: i * a.x,
		y: r * a.y
	};
}
function ke(e, t, n) {
	let r;
	if (t === "viewport" || t === "layoutViewport") r = De(e, n, t);
	else if (t === "document") r = Te(y(e));
	else if (b(t)) r = Oe(t, n);
	else {
		let n = ye(e);
		r = {
			x: t.x - n.x,
			y: t.y - n.y,
			width: t.width,
			height: t.height
		};
	}
	return s(r);
}
function Ae(e, t) {
	let n = t.get(e);
	if (n) return n;
	let r = pe(e, [], !1).filter((e) => b(e) && _(e) !== "body"), i = null, a = w(e).position === "fixed", o = a ? T(e) : e;
	for (; b(o) && !ue(o);) {
		let e = w(o), t = se(o), n = i ? i.position : a ? "fixed" : "";
		!t && (n === "fixed" || n === "absolute" && e.position === "static") ? r = r.filter((e) => e !== o) : i = e, o = T(o);
	}
	return t.set(e, r), r;
}
function je(e) {
	let { element: t, boundary: i, rootBoundary: a, strategy: o } = e, s = [...i === "clippingAncestors" ? re(t) ? [] : Ae(t, this._c) : [].concat(i), a], c = ke(t, s[0], o), l = c.top, u = c.right, d = c.bottom, f = c.left;
	for (let e = 1; e < s.length; e++) {
		let i = ke(t, s[e], o);
		l = r(i.top, l), u = n(i.right, u), d = n(i.bottom, d), f = r(i.left, f);
	}
	return {
		width: u - f,
		height: d - l,
		x: f,
		y: l
	};
}
function Me(e) {
	let { width: t, height: n } = he(e);
	return {
		width: t,
		height: n
	};
}
function Ne(e, t, n) {
	let r = x(t), i = y(t), a = n === "fixed", s = E(e, !0, a, t), c = {
		scrollLeft: 0,
		scrollTop: 0
	}, l = o(0);
	if ((r || !a) && ((_(t) !== "body" || S(i)) && (c = de(t)), r)) {
		let e = E(t, !0, a, t);
		l.x = e.x + t.clientLeft, l.y = e.y + t.clientTop;
	}
	!r && i && (l.x = xe(i));
	let u = i && !r && !a ? Se(i, c) : o(0);
	return {
		x: s.left + c.scrollLeft - l.x - u.x,
		y: s.top + c.scrollTop - l.y - u.y,
		width: s.width,
		height: s.height
	};
}
function Pe(e) {
	return w(e).position === "static";
}
function Fe(e, t) {
	if (!x(e) || w(e).position === "fixed") return null;
	if (t) return t(e);
	let n = e.offsetParent;
	return y(e) === n && (n = n.ownerDocument.body), n;
}
function Ie(e, t) {
	let n = v(e);
	if (re(e)) return n;
	if (!x(e)) {
		let t = T(e);
		for (; t && !ue(t);) {
			if (b(t) && !Pe(t)) return t;
			t = T(t);
		}
		return n;
	}
	let r = Fe(e, t);
	for (; r && ne(r) && Pe(r);) r = Fe(r, t);
	return r && ue(r) && Pe(r) && !se(r) ? n : r || ce(e) || n;
}
var Le = /* @__PURE__ */ function() {
	var e = l(function* (e) {
		let t = this.getOffsetParent || Ie, n = this.getDimensions, r = yield n(e.floating);
		return {
			reference: Ne(e.reference, yield t(e.floating), e.strategy),
			floating: {
				x: 0,
				y: 0,
				width: r.width,
				height: r.height
			}
		};
	});
	return function(t) {
		return e.apply(this, arguments);
	};
}();
function Re(e) {
	return w(e).direction === "rtl";
}
var D = {
	convertOffsetParentRelativeRectToViewportRelativeRect: Ce,
	getDocumentElement: y,
	getClippingRect: je,
	getOffsetParent: Ie,
	getElementRects: Le,
	getClientRects: we,
	getDimensions: Me,
	getScale: _e,
	isElement: b,
	isRTL: Re
};
function ze(e, t) {
	return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
}
function Be(e, t, i) {
	let o = null, s, c = y(e);
	function l() {
		var e;
		clearTimeout(s), (e = o) == null || e.disconnect(), o = null;
	}
	function u(i, d) {
		i === void 0 && (i = !1), d === void 0 && (d = 1), l();
		let f = e.getBoundingClientRect(), { left: p, top: m, width: g, height: _ } = f;
		if (i || t(), !g || !_) return;
		let v = a(m), y = a(c.clientWidth - (p + g)), ee = a(c.clientHeight - (m + _)), b = a(p), x = {
			rootMargin: -v + "px " + -y + "px " + -ee + "px " + -b + "px",
			threshold: r(0, n(1, d)) || 1
		}, te = !0;
		function S(t) {
			let n = t[0].intersectionRatio;
			if (!ze(f, e.getBoundingClientRect())) return u();
			if (n !== d) {
				if (!te) return u();
				n ? u(!1, n) : s = setTimeout(() => {
					u(!1, 1e-7);
				}, 1e3);
			}
			te = !1;
		}
		try {
			o = new IntersectionObserver(S, h(h({}, x), {}, { root: c.ownerDocument }));
		} catch (e) {
			o = new IntersectionObserver(S, x);
		}
		o.observe(e);
	}
	let d = v(e), f = () => u(i);
	return d.addEventListener("resize", f), u(!0), () => {
		d.removeEventListener("resize", f), l();
	};
}
function Ve(e, t, n, r) {
	r === void 0 && (r = {});
	let { ancestorScroll: i = !0, ancestorResize: a = !0, elementResize: o = typeof ResizeObserver == "function", layoutShift: s = typeof IntersectionObserver == "function", animationFrame: c = !1 } = r, l = ge(e), u = i || a ? [...l ? pe(l) : [], ...t ? pe(t) : []] : [];
	u.forEach((e) => {
		i && e.addEventListener("scroll", n), a && e.addEventListener("resize", n);
	});
	let d = l && s ? Be(l, n, a) : null, f = -1, p = null;
	o && (p = new ResizeObserver((e) => {
		let [r] = e;
		r && r.target === l && p && t && (p.unobserve(t), cancelAnimationFrame(f), f = requestAnimationFrame(() => {
			var e;
			(e = p) == null || e.observe(t);
		})), n();
	}), l && !c && p.observe(l), t && p.observe(t));
	let m, h = c ? E(e) : null;
	c && g();
	function g() {
		let t = E(e);
		h && !ze(h, t) && n(), h = t, m = requestAnimationFrame(g);
	}
	return n(), () => {
		var e;
		u.forEach((e) => {
			i && e.removeEventListener("scroll", n), a && e.removeEventListener("resize", n);
		}), d == null || d(), (e = p) == null || e.disconnect(), p = null, c && cancelAnimationFrame(m);
	};
}
//#endregion
//#region node_modules/css-tree/lib/utils/List.js
var O = null, He = class e {
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
	createItem(t) {
		return e.createItem(t);
	}
	allocateCursor(e, t) {
		let n;
		return O === null ? n = {
			prev: e,
			next: t,
			cursor: this.cursor
		} : (n = O, O = O.cursor, n.prev = e, n.next = t, n.cursor = this.cursor), this.cursor = n, n;
	}
	releaseCursor() {
		let { cursor: e } = this;
		this.cursor = e.cursor, e.prev = null, e.next = null, e.cursor = O, O = e;
	}
	updateCursors(e, t, n, r) {
		let { cursor: i } = this;
		for (; i !== null;) i.prev === e && (i.prev = t), i.next === n && (i.next = r), i = i.cursor;
	}
	*[Symbol.iterator]() {
		for (let e = this.head; e !== null; e = e.next) yield e.data;
	}
	get size() {
		let e = 0;
		for (let t = this.head; t !== null; t = t.next) e++;
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
	fromArray(t) {
		let n = null;
		this.head = null;
		for (let r of t) {
			let t = e.createItem(r);
			n === null ? this.head = t : n.next = t, t.prev = n, n = t;
		}
		return this.tail = n, this;
	}
	toArray() {
		return [...this];
	}
	toJSON() {
		return [...this];
	}
	forEach(e, t = this) {
		let n = this.allocateCursor(null, this.head);
		for (; n.next !== null;) {
			let r = n.next;
			n.next = r.next, e.call(t, r.data, r, this);
		}
		this.releaseCursor();
	}
	forEachRight(e, t = this) {
		let n = this.allocateCursor(this.tail, null);
		for (; n.prev !== null;) {
			let r = n.prev;
			n.prev = r.prev, e.call(t, r.data, r, this);
		}
		this.releaseCursor();
	}
	reduce(e, t, n = this) {
		let r = this.allocateCursor(null, this.head), i = t, a;
		for (; r.next !== null;) a = r.next, r.next = a.next, i = e.call(n, i, a.data, a, this);
		return this.releaseCursor(), i;
	}
	reduceRight(e, t, n = this) {
		let r = this.allocateCursor(this.tail, null), i = t, a;
		for (; r.prev !== null;) a = r.prev, r.prev = a.prev, i = e.call(n, i, a.data, a, this);
		return this.releaseCursor(), i;
	}
	some(e, t = this) {
		for (let n = this.head; n !== null; n = n.next) if (e.call(t, n.data, n, this)) return !0;
		return !1;
	}
	map(t, n = this) {
		let r = new e();
		for (let e = this.head; e !== null; e = e.next) r.appendData(t.call(n, e.data, e, this));
		return r;
	}
	filter(t, n = this) {
		let r = new e();
		for (let e = this.head; e !== null; e = e.next) t.call(n, e.data, e, this) && r.appendData(e.data);
		return r;
	}
	nextUntil(e, t, n = this) {
		if (e === null) return;
		let r = this.allocateCursor(null, e);
		for (; r.next !== null;) {
			let e = r.next;
			if (r.next = e.next, t.call(n, e.data, e, this)) break;
		}
		this.releaseCursor();
	}
	prevUntil(e, t, n = this) {
		if (e === null) return;
		let r = this.allocateCursor(e, null);
		for (; r.prev !== null;) {
			let e = r.prev;
			if (r.prev = e.prev, t.call(n, e.data, e, this)) break;
		}
		this.releaseCursor();
	}
	clear() {
		this.head = null, this.tail = null;
	}
	copy() {
		let t = new e();
		for (let e of this) t.appendData(e);
		return t;
	}
	prepend(e) {
		return this.updateCursors(null, e, this.head, e), this.head === null ? this.tail = e : (this.head.prev = e, e.next = this.head), this.head = e, this;
	}
	prependData(t) {
		return this.prepend(e.createItem(t));
	}
	append(e) {
		return this.insert(e);
	}
	appendData(t) {
		return this.insert(e.createItem(t));
	}
	insert(e, t = null) {
		if (t !== null) {
			if (this.updateCursors(t.prev, e, t, e), t.prev === null) {
				if (this.head !== t) throw Error("before doesn't belong to list");
				this.head = e, t.prev = e, e.next = t, this.updateCursors(null, e);
			} else t.prev.next = e, e.prev = t.prev, t.prev = e, e.next = t;
		} else this.updateCursors(this.tail, e, null, e), this.tail === null ? this.head = e : (this.tail.next = e, e.prev = this.tail), this.tail = e;
		return this;
	}
	insertData(t, n) {
		return this.insert(e.createItem(t), n);
	}
	remove(e) {
		if (this.updateCursors(e, e.prev, e, e.next), e.prev !== null) e.prev.next = e.next;
		else {
			if (this.head !== e) throw Error("item doesn't belong to list");
			this.head = e.next;
		}
		if (e.next !== null) e.next.prev = e.prev;
		else {
			if (this.tail !== e) throw Error("item doesn't belong to list");
			this.tail = e.prev;
		}
		return e.prev = null, e.next = null, e;
	}
	push(t) {
		this.insert(e.createItem(t));
	}
	pop() {
		return this.tail === null ? null : this.remove(this.tail);
	}
	unshift(t) {
		this.prepend(e.createItem(t));
	}
	shift() {
		return this.head === null ? null : this.remove(this.head);
	}
	prependList(e) {
		return this.insertList(e, this.head);
	}
	appendList(e) {
		return this.insertList(e);
	}
	insertList(e, t) {
		return e.head === null ? this : (t == null ? (this.updateCursors(this.tail, e.tail, null, e.head), this.tail === null ? this.head = e.head : (this.tail.next = e.head, e.head.prev = this.tail), this.tail = e.tail) : (this.updateCursors(t.prev, e.tail, t, e.head), t.prev === null ? this.head = e.head : (t.prev.next = e.head, e.head.prev = t.prev), t.prev = e.tail, e.tail.next = t), e.head = null, e.tail = null, this);
	}
	replace(e, t) {
		"head" in t ? this.insertList(t, e) : this.insert(t, e), this.remove(e);
	}
};
//#endregion
//#region node_modules/css-tree/lib/utils/clone.js
function Ue(e) {
	let t = {};
	for (let n of Object.keys(e)) {
		let r = e[n];
		r && (Array.isArray(r) || r instanceof He ? r = r.map(Ue) : r.constructor === Object && (r = Ue(r))), t[n] = r;
	}
	return t;
}
//#endregion
//#region node_modules/css-tree/lib/tokenizer/char-code-definitions.js
var We = 0;
function k(e) {
	return e >= 48 && e <= 57;
}
function Ge(e) {
	return k(e) || e >= 65 && e <= 70 || e >= 97 && e <= 102;
}
function Ke(e) {
	return e >= 65 && e <= 90;
}
function qe(e) {
	return e >= 97 && e <= 122;
}
function Je(e) {
	return Ke(e) || qe(e);
}
function Ye(e) {
	return e >= 128;
}
function Xe(e) {
	return Je(e) || Ye(e) || e === 95;
}
function Ze(e) {
	return Xe(e) || k(e) || e === 45;
}
function Qe(e) {
	return e >= 0 && e <= 8 || e === 11 || e >= 14 && e <= 31 || e === 127;
}
function $e(e) {
	return e === 10 || e === 13 || e === 12;
}
function A(e) {
	return $e(e) || e === 32 || e === 9;
}
function j(e, t) {
	return !(e !== 92 || $e(t) || t === We);
}
function et(e, t, n) {
	return e === 45 ? Xe(t) || t === 45 || j(t, n) : Xe(e) ? !0 : e === 92 && j(e, t);
}
function tt(e, t, n) {
	return e === 43 || e === 45 ? k(t) ? 2 : t === 46 && k(n) ? 3 : 0 : e === 46 ? k(t) ? 2 : 0 : +!!k(e);
}
function nt(e) {
	return +(e === 65279 || e === 65534);
}
var rt = Array(128);
for (let e = 0; e < rt.length; e++) rt[e] = A(e) && 130 || k(e) && 131 || Xe(e) && 132 || Qe(e) && 133 || e || 128;
function it(e) {
	return e < 128 ? rt[e] : 132;
}
//#endregion
//#region node_modules/css-tree/lib/tokenizer/utils.js
function at(e, t) {
	return t < e.length ? e.charCodeAt(t) : 0;
}
function ot(e, t, n) {
	return n === 13 && at(e, t + 1) === 10 ? 2 : 1;
}
function st(e, t, n) {
	let r = e.charCodeAt(t);
	return Ke(r) && (r |= 32), r === n;
}
function ct(e, t, n, r) {
	if (n - t !== r.length || t < 0 || n > e.length) return !1;
	for (let i = t; i < n; i++) {
		let n = r.charCodeAt(i - t), a = e.charCodeAt(i);
		if (Ke(a) && (a |= 32), a !== n) return !1;
	}
	return !0;
}
function lt(e, t) {
	for (; t >= 0 && A(e.charCodeAt(t)); t--);
	return t + 1;
}
function ut(e, t) {
	for (; t < e.length && A(e.charCodeAt(t)); t++);
	return t;
}
function dt(e, t) {
	for (; t < e.length && k(e.charCodeAt(t)); t++);
	return t;
}
function M(e, t) {
	if (t += 2, Ge(at(e, t - 1))) {
		for (let n = Math.min(e.length, t + 5); t < n && Ge(at(e, t)); t++);
		let n = at(e, t);
		A(n) && (t += ot(e, t, n));
	}
	return t;
}
function ft(e, t) {
	for (; t < e.length; t++) {
		let n = e.charCodeAt(t);
		if (!Ze(n)) {
			if (j(n, at(e, t + 1))) {
				t = M(e, t) - 1;
				continue;
			}
			break;
		}
	}
	return t;
}
function pt(e, t) {
	let n = e.charCodeAt(t);
	if ((n === 43 || n === 45) && (n = e.charCodeAt(t += 1)), k(n) && (t = dt(e, t + 1), n = e.charCodeAt(t)), n === 46 && k(e.charCodeAt(t + 1)) && (t += 2, t = dt(e, t)), st(e, t, 101)) {
		let r = 0;
		n = e.charCodeAt(t + 1), (n === 45 || n === 43) && (r = 1, n = e.charCodeAt(t + 2)), k(n) && (t = dt(e, t + 1 + r + 1));
	}
	return t;
}
function mt(e, t) {
	for (; t < e.length; t++) {
		let n = e.charCodeAt(t);
		if (n === 41) {
			t++;
			break;
		}
		j(n, at(e, t + 1)) && (t = M(e, t));
	}
	return t;
}
function ht(e) {
	if (e.length === 1 && !Ge(e.charCodeAt(0))) return e[0];
	let t = parseInt(e, 16);
	return (t === 0 || t >= 55296 && t <= 57343 || t > 1114111) && (t = 65533), String.fromCodePoint(t);
}
//#endregion
//#region node_modules/css-tree/lib/tokenizer/names.js
var gt = /* @__PURE__ */ "EOF-token.ident-token.function-token.at-keyword-token.hash-token.string-token.bad-string-token.url-token.bad-url-token.delim-token.number-token.percentage-token.dimension-token.whitespace-token.CDO-token.CDC-token.colon-token.semicolon-token.comma-token.[-token.]-token.(-token.)-token.{-token.}-token.comment-token".split("."), _t = 16384;
function vt(e = null, t) {
	return e === null || e.length < t ? new Uint32Array(Math.max(t + 1024, _t)) : e;
}
//#endregion
//#region node_modules/css-tree/lib/tokenizer/OffsetToLocation.js
var yt = 10, bt = 12, xt = 13;
function St(e) {
	let t = e.source, n = t.length, r = t.length > 0 ? nt(t.charCodeAt(0)) : 0, i = vt(e.lines, n), a = vt(e.columns, n), o = e.startLine, s = e.startColumn;
	for (let e = r; e < n; e++) {
		let r = t.charCodeAt(e);
		i[e] = o, a[e] = s++, (r === yt || r === xt || r === bt) && (r === xt && e + 1 < n && t.charCodeAt(e + 1) === yt && (e++, i[e] = o, a[e] = s), o++, s = 1);
	}
	i[n] = o, a[n] = s, e.lines = i, e.columns = a, e.computed = !0;
}
var Ct = class {
	constructor(e, t, n, r) {
		this.setSource(e, t, n, r), this.lines = null, this.columns = null;
	}
	setSource(e = "", t = 0, n = 1, r = 1) {
		this.source = e, this.startOffset = t, this.startLine = n, this.startColumn = r, this.computed = !1;
	}
	getLocation(e, t) {
		return this.computed || St(this), {
			source: t,
			offset: this.startOffset + e,
			line: this.lines[e],
			column: this.columns[e]
		};
	}
	getLocationRange(e, t, n) {
		return this.computed || St(this), {
			source: n,
			start: {
				offset: this.startOffset + e,
				line: this.lines[e],
				column: this.columns[e]
			},
			end: {
				offset: this.startOffset + t,
				line: this.lines[t],
				column: this.columns[t]
			}
		};
	}
}, N = 16777215, P = 24, wt = 1, Tt = 2, F = /* @__PURE__ */ new Uint8Array(32);
F[2] = 22, F[21] = 22, F[19] = 20, F[23] = 24;
var I = /* @__PURE__ */ new Uint8Array(32);
I[2] = wt, I[21] = wt, I[19] = wt, I[23] = wt, I[22] = Tt, I[20] = Tt, I[24] = Tt;
function Et(e, t, n) {
	return e < t ? t : e > n ? n : e;
}
var Dt = class {
	constructor(e, t) {
		this.setSource(e, t);
	}
	reset() {
		this.eof = !1, this.tokenIndex = -1, this.tokenType = 0, this.tokenStart = this.firstCharOffset, this.tokenEnd = this.firstCharOffset;
	}
	setSource(e = "", t = () => {}) {
		e = String(e || "");
		let n = e.length, r = vt(this.offsetAndType, e.length + 1), i = vt(this.balance, e.length + 1), a = 0, o = -1, s = 0, c = e.length;
		this.offsetAndType = null, this.balance = null, i.fill(0), t(e, (e, t, n) => {
			let l = a++;
			if (r[l] = e << P | n, o === -1 && (o = t), i[l] = c, e === s) {
				let e = i[c];
				i[c] = l, c = e, s = F[r[e] >> P];
			} else this.isBlockOpenerTokenType(e) && (c = l, s = F[e]);
		}), r[a] = 0 << P | n, i[a] = a;
		for (let e = 0; e < a; e++) {
			let t = i[e];
			if (t <= e) {
				let n = i[t];
				n !== e && (i[e] = n);
			} else t > a && (i[e] = a);
		}
		this.source = e, this.firstCharOffset = o === -1 ? 0 : o, this.tokenCount = a, this.offsetAndType = r, this.balance = i, this.reset(), this.next();
	}
	lookupType(e) {
		return e += this.tokenIndex, e < this.tokenCount ? this.offsetAndType[e] >> P : 0;
	}
	lookupTypeNonSC(e) {
		for (let t = this.tokenIndex; t < this.tokenCount; t++) {
			let n = this.offsetAndType[t] >> P;
			if (n !== 13 && n !== 25 && e-- === 0) return n;
		}
		return 0;
	}
	lookupOffset(e) {
		return e += this.tokenIndex, e < this.tokenCount ? this.offsetAndType[e - 1] & N : this.source.length;
	}
	lookupOffsetNonSC(e) {
		for (let t = this.tokenIndex; t < this.tokenCount; t++) {
			let n = this.offsetAndType[t] >> P;
			if (n !== 13 && n !== 25 && e-- === 0) return t - this.tokenIndex;
		}
		return 0;
	}
	lookupValue(e, t) {
		return e += this.tokenIndex, e < this.tokenCount && ct(this.source, this.offsetAndType[e - 1] & N, this.offsetAndType[e] & N, t);
	}
	getTokenStart(e) {
		return e === this.tokenIndex ? this.tokenStart : e > 0 ? e < this.tokenCount ? this.offsetAndType[e - 1] & N : this.offsetAndType[this.tokenCount] & N : this.firstCharOffset;
	}
	getTokenEnd(e) {
		return e === this.tokenIndex ? this.tokenEnd : this.offsetAndType[Et(e, 0, this.tokenCount)] & N;
	}
	getTokenType(e) {
		return e === this.tokenIndex ? this.tokenType : this.offsetAndType[Et(e, 0, this.tokenCount)] >> P;
	}
	substrToCursor(e) {
		return this.source.substring(e, this.tokenStart);
	}
	isBlockOpenerTokenType(e) {
		return I[e] === wt;
	}
	isBlockCloserTokenType(e) {
		return I[e] === Tt;
	}
	getBlockTokenPairIndex(e) {
		let t = this.getTokenType(e);
		if (I[t] === 1) {
			let n = this.balance[e], r = this.getTokenType(n);
			return F[t] === r ? n : -1;
		}
		if (I[t] === 2) {
			let n = this.balance[e];
			return F[this.getTokenType(n)] === t ? n : -1;
		}
		return -1;
	}
	isBalanceEdge(e) {
		return this.balance[this.tokenIndex] < e;
	}
	isDelim(e, t) {
		return t ? this.lookupType(t) === 9 && this.source.charCodeAt(this.lookupOffset(t)) === e : this.tokenType === 9 && this.source.charCodeAt(this.tokenStart) === e;
	}
	skip(e) {
		let t = this.tokenIndex + e;
		t < this.tokenCount ? (this.tokenIndex = t, this.tokenStart = this.offsetAndType[t - 1] & N, t = this.offsetAndType[t], this.tokenType = t >> P, this.tokenEnd = t & N) : (this.tokenIndex = this.tokenCount, this.next());
	}
	next() {
		let e = this.tokenIndex + 1;
		e < this.tokenCount ? (this.tokenIndex = e, this.tokenStart = this.tokenEnd, e = this.offsetAndType[e], this.tokenType = e >> P, this.tokenEnd = e & N) : (this.eof = !0, this.tokenIndex = this.tokenCount, this.tokenType = 0, this.tokenStart = this.tokenEnd = this.source.length);
	}
	skipSC() {
		for (; this.tokenType === 13 || this.tokenType === 25;) this.next();
	}
	skipUntilBalanced(e, t) {
		let n = e, r = 0, i = 0;
		loop: for (; n < this.tokenCount; n++) {
			if (r = this.balance[n], r < e) break loop;
			switch (i = n > 0 ? this.offsetAndType[n - 1] & N : this.firstCharOffset, t(this.source.charCodeAt(i))) {
				case 1: break loop;
				case 2:
					n++;
					break loop;
				default: this.isBlockOpenerTokenType(this.offsetAndType[n] >> P) && (n = r);
			}
		}
		this.skip(n - this.tokenIndex);
	}
	forEachToken(e) {
		for (let t = 0, n = this.firstCharOffset; t < this.tokenCount; t++) {
			let r = n, i = this.offsetAndType[t], a = i & N, o = i >> P;
			n = a, e(o, r, a, t);
		}
	}
	dump() {
		let e = Array(this.tokenCount);
		return this.forEachToken((t, n, r, i) => {
			e[i] = {
				idx: i,
				type: gt[t],
				chunk: this.source.substring(n, r),
				balance: this.balance[i]
			};
		}), e;
	}
};
//#endregion
//#region node_modules/css-tree/lib/tokenizer/index.js
function Ot(e, t) {
	function n(t) {
		return t < s ? e.charCodeAt(t) : 0;
	}
	function r() {
		if (l = pt(e, l), et(n(l), n(l + 1), n(l + 2))) {
			u = 12, l = ft(e, l);
			return;
		}
		if (n(l) === 37) {
			u = 11, l++;
			return;
		}
		u = 10;
	}
	function i() {
		let t = l;
		if (l = ft(e, l), ct(e, t, l, "url") && n(l) === 40) {
			if (l = ut(e, l + 1), n(l) === 34 || n(l) === 39) {
				u = 2, l = t + 4;
				return;
			}
			o();
			return;
		}
		if (n(l) === 40) {
			u = 2, l++;
			return;
		}
		u = 1;
	}
	function a(t) {
		for (t || (t = n(l++)), u = 5; l < e.length; l++) {
			let r = e.charCodeAt(l);
			switch (it(r)) {
				case t:
					l++;
					return;
				case 130:
					if ($e(r)) {
						l += ot(e, l, r), u = 6;
						return;
					}
					break;
				case 92:
					if (l === e.length - 1) break;
					let i = n(l + 1);
					$e(i) ? l += ot(e, l + 1, i) : j(r, i) && (l = M(e, l) - 1);
			}
		}
	}
	function o() {
		for (u = 7, l = ut(e, l); l < e.length; l++) {
			let t = e.charCodeAt(l);
			switch (it(t)) {
				case 41:
					l++;
					return;
				case 130:
					if (l = ut(e, l), n(l) === 41 || l >= e.length) {
						l < e.length && l++;
						return;
					}
					l = mt(e, l), u = 8;
					return;
				case 34:
				case 39:
				case 40:
				case 133:
					l = mt(e, l), u = 8;
					return;
				case 92:
					if (j(t, n(l + 1))) {
						l = M(e, l) - 1;
						break;
					}
					l = mt(e, l), u = 8;
					return;
			}
		}
	}
	e = String(e || "");
	let s = e.length, c = nt(n(0)), l = c, u;
	for (; l < s;) {
		let o = e.charCodeAt(l);
		switch (it(o)) {
			case 130:
				u = 13, l = ut(e, l + 1);
				break;
			case 34:
				a();
				break;
			case 35:
				Ze(n(l + 1)) || j(n(l + 1), n(l + 2)) ? (u = 4, l = ft(e, l + 1)) : (u = 9, l++);
				break;
			case 39:
				a();
				break;
			case 40:
				u = 21, l++;
				break;
			case 41:
				u = 22, l++;
				break;
			case 43:
				tt(o, n(l + 1), n(l + 2)) ? r() : (u = 9, l++);
				break;
			case 44:
				u = 18, l++;
				break;
			case 45:
				tt(o, n(l + 1), n(l + 2)) ? r() : n(l + 1) === 45 && n(l + 2) === 62 ? (u = 15, l += 3) : et(o, n(l + 1), n(l + 2)) ? i() : (u = 9, l++);
				break;
			case 46:
				tt(o, n(l + 1), n(l + 2)) ? r() : (u = 9, l++);
				break;
			case 47:
				n(l + 1) === 42 ? (u = 25, l = e.indexOf("*/", l + 2), l = l === -1 ? e.length : l + 2) : (u = 9, l++);
				break;
			case 58:
				u = 16, l++;
				break;
			case 59:
				u = 17, l++;
				break;
			case 60:
				n(l + 1) === 33 && n(l + 2) === 45 && n(l + 3) === 45 ? (u = 14, l += 4) : (u = 9, l++);
				break;
			case 64:
				et(n(l + 1), n(l + 2), n(l + 3)) ? (u = 3, l = ft(e, l + 1)) : (u = 9, l++);
				break;
			case 91:
				u = 19, l++;
				break;
			case 92:
				j(o, n(l + 1)) ? i() : (u = 9, l++);
				break;
			case 93:
				u = 20, l++;
				break;
			case 123:
				u = 23, l++;
				break;
			case 125:
				u = 24, l++;
				break;
			case 131:
				r();
				break;
			case 132:
				i();
				break;
			default: u = 9, l++;
		}
		t(u, c, c = l);
	}
}
//#endregion
//#region node_modules/css-tree/lib/utils/names.js
var kt = 45;
function At(e, t) {
	return t = t || 0, e.length - t >= 2 && e.charCodeAt(t) === kt && e.charCodeAt(t + 1) === kt;
}
//#endregion
//#region node_modules/css-tree/lib/utils/string.js
var jt = 92, Mt = 34, Nt = 39;
function Pt(e) {
	let t = e.length, n = e.charCodeAt(0), r = +(n === Mt || n === Nt), i = r === 1 && t > 1 && e.charCodeAt(t - 1) === n ? t - 2 : t - 1, a = "";
	for (let n = r; n <= i; n++) {
		let r = e.charCodeAt(n);
		if (r === jt) {
			if (n === i) {
				n !== t - 1 && (a = e.substr(n + 1));
				break;
			}
			if (r = e.charCodeAt(++n), j(jt, r)) {
				let t = n - 1, r = M(e, t);
				n = r - 1, a += ht(e.substring(t + 1, r));
			} else r === 13 && e.charCodeAt(n + 1) === 10 && n++;
		} else a += e[n];
	}
	return a;
}
function Ft(e, t) {
	let n = t ? "'" : "\"", r = t ? Nt : Mt, i = "", a = !1;
	for (let t = 0; t < e.length; t++) {
		let n = e.charCodeAt(t);
		if (n === 0) {
			i += "�";
			continue;
		}
		if (n <= 31 || n === 127) {
			i += "\\" + n.toString(16), a = !0;
			continue;
		}
		n === r || n === jt ? (i += "\\" + e.charAt(t), a = !1) : (a && (Ge(n) || A(n)) && (i += " "), i += e.charAt(t), a = !1);
	}
	return n + i + n;
}
//#endregion
//#region node_modules/css-tree/lib/utils/url.js
var It = 32, Lt = 92, Rt = 34, zt = 39, Bt = 40, Vt = 41;
function Ht(e) {
	let t = e.length, n = 4, r = e.charCodeAt(t - 1) === Vt ? t - 2 : t - 1, i = "";
	for (; n < r && A(e.charCodeAt(n));) n++;
	for (; n < r && A(e.charCodeAt(r));) r--;
	for (let a = n; a <= r; a++) {
		let n = e.charCodeAt(a);
		if (n === Lt) {
			if (a === r) {
				a !== t - 1 && (i = e.substr(a + 1));
				break;
			}
			if (n = e.charCodeAt(++a), j(Lt, n)) {
				let t = a - 1, n = M(e, t);
				a = n - 1, i += ht(e.substring(t + 1, n));
			} else n === 13 && e.charCodeAt(a + 1) === 10 && a++;
		} else i += e[a];
	}
	return i;
}
function Ut(e) {
	let t = "", n = !1;
	for (let r = 0; r < e.length; r++) {
		let i = e.charCodeAt(r);
		if (i === 0) {
			t += "�";
			continue;
		}
		if (i <= 31 || i === 127) {
			t += "\\" + i.toString(16), n = !0;
			continue;
		}
		i === It || i === Lt || i === Rt || i === zt || i === Bt || i === Vt ? (t += "\\" + e.charAt(r), n = !1) : (n && Ge(i) && (t += " "), t += e.charAt(r), n = !1);
	}
	return "url(" + t + ")";
}
//#endregion
//#region node_modules/css-tree/lib/walker/create.js
var { hasOwnProperty: Wt } = Object.prototype, Gt = function() {};
function Kt(e) {
	return typeof e == "function" ? e : Gt;
}
function qt(e, t) {
	return function(n, r, i) {
		n.type === t && e.call(this, n, r, i);
	};
}
function Jt(e, t) {
	let n = t.structure, r = [];
	for (let e in n) {
		if (Wt.call(n, e) === !1) continue;
		let t = n[e], i = {
			name: e,
			type: !1,
			nullable: !1
		};
		Array.isArray(t) || (t = [t]);
		for (let e of t) e === null ? i.nullable = !0 : typeof e == "string" ? i.type = "node" : Array.isArray(e) && (i.type = "list");
		i.type && r.push(i);
	}
	return r.length ? {
		context: t.walkContext,
		fields: r
	} : null;
}
function Yt(e) {
	let t = {};
	for (let n in e.node) if (Wt.call(e.node, n)) {
		let r = e.node[n];
		if (!r.structure) throw Error("Missed `structure` field in `" + n + "` node type definition");
		t[n] = Jt(n, r);
	}
	return t;
}
function Xt(e, t) {
	let n = e.fields.slice(), r = e.context, i = typeof r == "string";
	return t && n.reverse(), function(e, a, o, s) {
		let c;
		i && (c = a[r], a[r] = e);
		for (let r of n) {
			let n = e[r.name];
			if (!r.nullable || n) {
				if (r.type === "list") {
					if (t ? n.reduceRight(s, !1) : n.reduce(s, !1)) return !0;
				} else if (o(n)) return !0;
			}
		}
		i && (a[r] = c);
	};
}
function Zt({ StyleSheet: e, Atrule: t, Rule: n, Block: r, DeclarationList: i }) {
	return {
		Atrule: {
			StyleSheet: e,
			Atrule: t,
			Rule: n,
			Block: r
		},
		Rule: {
			StyleSheet: e,
			Atrule: t,
			Rule: n,
			Block: r
		},
		Declaration: {
			StyleSheet: e,
			Atrule: t,
			Rule: n,
			Block: r,
			DeclarationList: i
		}
	};
}
function Qt(e) {
	let t = Yt(e), n = {}, r = {}, i = Symbol("break-walk"), a = Symbol("skip-node");
	for (let e in t) Wt.call(t, e) && t[e] !== null && (n[e] = Xt(t[e], !1), r[e] = Xt(t[e], !0));
	let o = Zt(n), s = Zt(r), c = function(e, c) {
		function l(e, t, n) {
			let r = u.call(m, e, t, n);
			return r === i || r !== a && !!(f.hasOwnProperty(e.type) && f[e.type](e, m, l, p) || d.call(m, e, t, n) === i);
		}
		let u = Gt, d = Gt, f = n, p = (e, t, n, r) => e || l(t, n, r), m = {
			break: i,
			skip: a,
			root: e,
			stylesheet: null,
			atrule: null,
			atrulePrelude: null,
			rule: null,
			selector: null,
			block: null,
			declaration: null,
			function: null
		};
		if (typeof c == "function") u = c;
		else if (c && (u = Kt(c.enter), d = Kt(c.leave), c.reverse && (f = r), c.visit)) {
			if (o.hasOwnProperty(c.visit)) f = c.reverse ? s[c.visit] : o[c.visit];
			else if (!t.hasOwnProperty(c.visit)) throw Error("Bad value `" + c.visit + "` for `visit` option (should be: " + Object.keys(t).sort().join(", ") + ")");
			u = qt(u, c.visit), d = qt(d, c.visit);
		}
		if (u === Gt && d === Gt) throw Error("Neither `enter` nor `leave` walker handler is set or both aren't a function");
		l(e);
	};
	return c.break = i, c.skip = a, c.find = function(e, t) {
		let n = null;
		return c(e, function(e, r, a) {
			if (t.call(this, e, r, a)) return n = e, i;
		}), n;
	}, c.findLast = function(e, t) {
		let n = null;
		return c(e, {
			reverse: !0,
			enter(e, r, a) {
				if (t.call(this, e, r, a)) return n = e, i;
			}
		}), n;
	}, c.findAll = function(e, t) {
		let n = [];
		return c(e, function(e, r, i) {
			t.call(this, e, r, i) && n.push(e);
		}), n;
	}, c;
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/AnPlusB.js
var $t = /* @__PURE__ */ t({
	generate: () => cn,
	name: () => an,
	parse: () => sn,
	structure: () => on
}), L = 43, R = 45, en = 110, z = !0, tn = !1;
function nn(e, t) {
	let n = this.tokenStart + e, r = this.charCodeAt(n);
	for ((r === L || r === R) && (t && this.error("Number sign is not allowed"), n++); n < this.tokenEnd; n++) k(this.charCodeAt(n)) || this.error("Integer is expected", n);
}
function B(e) {
	return nn.call(this, 0, e);
}
function V(e, t) {
	if (!this.cmpChar(this.tokenStart + e, t)) {
		let n = "";
		switch (t) {
			case en:
				n = "N is expected";
				break;
			case R: n = "HyphenMinus is expected";
		}
		this.error(n, this.tokenStart + e);
	}
}
function rn() {
	let e = 0, t = 0, n = this.tokenType;
	for (; n === 13 || n === 25;) n = this.lookupType(++e);
	if (n !== 10) {
		if (this.isDelim(L, e) || this.isDelim(R, e)) {
			t = this.isDelim(L, e) ? L : R;
			do
				n = this.lookupType(++e);
			while (n === 13 || n === 25);
			n !== 10 && (this.skip(e), B.call(this, z));
		} else return null;
	}
	return e > 0 && this.skip(e), t === 0 && (n = this.charCodeAt(this.tokenStart), n !== L && n !== R && this.error("Number sign is expected")), B.call(this, t !== 0), t === R ? "-" + this.consume(10) : this.consume(10);
}
var an = "AnPlusB", on = {
	a: [String, null],
	b: [String, null]
};
function sn() {
	let e = this.tokenStart, t = null, n = null;
	if (this.tokenType === 10) B.call(this, tn), n = this.consume(10);
	else if (this.tokenType === 1 && this.cmpChar(this.tokenStart, R)) switch (t = "-1", V.call(this, 1, en), this.tokenEnd - this.tokenStart) {
		case 2:
			this.next(), n = rn.call(this);
			break;
		case 3:
			V.call(this, 2, R), this.next(), this.skipSC(), B.call(this, z), n = "-" + this.consume(10);
			break;
		default: V.call(this, 2, R), nn.call(this, 3, z), this.next(), n = this.substrToCursor(e + 2);
	}
	else if (this.tokenType === 1 || this.isDelim(L) && this.lookupType(1) === 1) {
		let r = 0;
		switch (t = "1", this.isDelim(L) && (r = 1, this.next()), V.call(this, 0, en), this.tokenEnd - this.tokenStart) {
			case 1:
				this.next(), n = rn.call(this);
				break;
			case 2:
				V.call(this, 1, R), this.next(), this.skipSC(), B.call(this, z), n = "-" + this.consume(10);
				break;
			default: V.call(this, 1, R), nn.call(this, 2, z), this.next(), n = this.substrToCursor(e + r + 1);
		}
	} else if (this.tokenType === 12) {
		let r = this.charCodeAt(this.tokenStart), i = r === L || r === R, a = this.tokenStart + i;
		for (; a < this.tokenEnd && k(this.charCodeAt(a)); a++);
		a === this.tokenStart + i && this.error("Integer is expected", this.tokenStart + i), V.call(this, a - this.tokenStart, en), t = this.substring(e, a), a + 1 === this.tokenEnd ? (this.next(), n = rn.call(this)) : (V.call(this, a - this.tokenStart + 1, R), a + 2 === this.tokenEnd ? (this.next(), this.skipSC(), B.call(this, z), n = "-" + this.consume(10)) : (nn.call(this, a - this.tokenStart + 2, z), this.next(), n = this.substrToCursor(a + 1)));
	} else this.error();
	return t !== null && t.charCodeAt(0) === L && (t = t.substr(1)), n !== null && n.charCodeAt(0) === L && (n = n.substr(1)), {
		type: "AnPlusB",
		loc: this.getLocation(e, this.tokenStart),
		a: t,
		b: n
	};
}
function cn(e) {
	if (e.a) {
		let t = e.a === "+1" && "n" || e.a === "1" && "n" || e.a === "-1" && "-n" || e.a + "n";
		if (e.b) {
			let n = e.b[0] === "-" || e.b[0] === "+" ? e.b : "+" + e.b;
			this.tokenize(t + n);
		} else this.tokenize(t);
	} else this.tokenize(e.b);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Atrule.js
var ln = /* @__PURE__ */ t({
	generate: () => gn,
	name: () => fn,
	parse: () => hn,
	structure: () => mn,
	walkContext: () => pn
});
function un() {
	return this.Raw(this.consumeUntilLeftCurlyBracketOrSemicolon, !0);
}
function dn() {
	for (let e = 1, t; t = this.lookupType(e); e++) {
		if (t === 24) return !0;
		if (t === 23 || t === 3) return !1;
	}
	return !1;
}
var fn = "Atrule", pn = "atrule", mn = {
	name: String,
	prelude: [
		"AtrulePrelude",
		"Raw",
		null
	],
	block: ["Block", null]
};
function hn(e = !1) {
	let t = this.tokenStart, n, r, i = null, a = null;
	switch (this.eat(3), n = this.substrToCursor(t + 1), r = n.toLowerCase(), this.skipSC(), this.eof === !1 && this.tokenType !== 23 && this.tokenType !== 17 && (i = this.parseAtrulePrelude ? this.parseWithFallback(this.AtrulePrelude.bind(this, n, e), un) : un.call(this, this.tokenIndex), this.skipSC()), this.tokenType) {
		case 17:
			this.next();
			break;
		case 23: a = hasOwnProperty.call(this.atrule, r) && typeof this.atrule[r].block == "function" ? this.atrule[r].block.call(this, e) : this.Block(dn.call(this));
	}
	return {
		type: "Atrule",
		loc: this.getLocation(t, this.tokenStart),
		name: n,
		prelude: i,
		block: a
	};
}
function gn(e) {
	this.token(3, "@" + e.name), e.prelude !== null && this.node(e.prelude), e.block ? this.node(e.block) : this.token(17, ";");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/AtrulePrelude.js
var _n = /* @__PURE__ */ t({
	generate: () => Sn,
	name: () => vn,
	parse: () => xn,
	structure: () => bn,
	walkContext: () => yn
}), vn = "AtrulePrelude", yn = "atrulePrelude", bn = { children: [[]] };
function xn(e) {
	let t = null;
	return e !== null && (e = e.toLowerCase()), this.skipSC(), t = hasOwnProperty.call(this.atrule, e) && typeof this.atrule[e].prelude == "function" ? this.atrule[e].prelude.call(this) : this.readSequence(this.scope.AtrulePrelude), this.skipSC(), this.eof !== !0 && this.tokenType !== 23 && this.tokenType !== 17 && this.error("Semicolon or block is expected"), {
		type: "AtrulePrelude",
		loc: this.getLocationFromList(t),
		children: t
	};
}
function Sn(e) {
	this.children(e);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/AttributeSelector.js
var Cn = /* @__PURE__ */ t({
	generate: () => Fn,
	name: () => Mn,
	parse: () => Pn,
	structure: () => Nn
}), wn = 36, Tn = 42, En = 61, Dn = 94, On = 124, kn = 126;
function An() {
	this.eof && this.error("Unexpected end of input");
	let e = this.tokenStart, t = !1;
	return this.isDelim(Tn) ? (t = !0, this.next()) : this.isDelim(On) || this.eat(1), this.isDelim(On) ? this.charCodeAt(this.tokenStart + 1) === En ? t && this.error("Identifier is expected", this.tokenEnd) : (this.next(), this.eat(1)) : t && this.error("Vertical line is expected"), {
		type: "Identifier",
		loc: this.getLocation(e, this.tokenStart),
		name: this.substrToCursor(e)
	};
}
function jn() {
	let e = this.tokenStart, t = this.charCodeAt(e);
	return t !== En && t !== kn && t !== Dn && t !== wn && t !== Tn && t !== On && this.error("Attribute selector (=, ~=, ^=, $=, *=, |=) is expected"), this.next(), t !== En && (this.isDelim(En) || this.error("Equal sign is expected"), this.next()), this.substrToCursor(e);
}
var Mn = "AttributeSelector", Nn = {
	name: "Identifier",
	matcher: [String, null],
	value: [
		"String",
		"Identifier",
		null
	],
	flags: [String, null]
};
function Pn() {
	let e = this.tokenStart, t, n = null, r = null, i = null;
	return this.eat(19), this.skipSC(), t = An.call(this), this.skipSC(), this.tokenType !== 20 && (this.tokenType !== 1 && (n = jn.call(this), this.skipSC(), r = this.tokenType === 5 ? this.String() : this.Identifier(), this.skipSC()), this.tokenType === 1 && (i = this.consume(1), this.skipSC())), this.eat(20), {
		type: "AttributeSelector",
		loc: this.getLocation(e, this.tokenStart),
		name: t,
		matcher: n,
		value: r,
		flags: i
	};
}
function Fn(e) {
	this.token(9, "["), this.node(e.name), e.matcher !== null && (this.tokenize(e.matcher), this.node(e.value)), e.flags !== null && this.token(1, e.flags), this.token(9, "]");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Block.js
var In = /* @__PURE__ */ t({
	generate: () => Kn,
	name: () => Hn,
	parse: () => Gn,
	structure: () => Wn,
	walkContext: () => Un
}), Ln = 38;
function Rn() {
	return this.Raw(null, !0);
}
function zn() {
	return this.parseWithFallback(this.Rule, Rn);
}
function Bn() {
	return this.Raw(this.consumeUntilSemicolonIncluded, !0);
}
function Vn() {
	if (this.tokenType === 17) return Bn.call(this, this.tokenIndex);
	let e = this.parseWithFallback(this.Declaration, Bn);
	return this.tokenType === 17 && this.next(), e;
}
var Hn = "Block", Un = "block", Wn = { children: [[
	"Atrule",
	"Rule",
	"Declaration"
]] };
function Gn(e) {
	let t = e ? Vn : zn, n = this.tokenStart, r = this.createList();
	this.eat(23);
	scan: for (; !this.eof;) switch (this.tokenType) {
		case 24: break scan;
		case 13:
		case 25:
			this.next();
			break;
		case 3:
			r.push(this.parseWithFallback(this.Atrule.bind(this, e), Rn));
			break;
		default: e && this.isDelim(Ln) ? r.push(zn.call(this)) : r.push(t.call(this));
	}
	return this.eof || this.eat(24), {
		type: "Block",
		loc: this.getLocation(n, this.tokenStart),
		children: r
	};
}
function Kn(e) {
	this.token(23, "{"), this.children(e, (e) => {
		e.type === "Declaration" && this.token(17, ";");
	}), this.token(24, "}");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Brackets.js
var qn = /* @__PURE__ */ t({
	generate: () => Zn,
	name: () => Jn,
	parse: () => Xn,
	structure: () => Yn
}), Jn = "Brackets", Yn = { children: [[]] };
function Xn(e, t) {
	let n = this.tokenStart, r = null;
	return this.eat(19), r = e.call(this, t), this.eof || this.eat(20), {
		type: "Brackets",
		loc: this.getLocation(n, this.tokenStart),
		children: r
	};
}
function Zn(e) {
	this.token(9, "["), this.children(e), this.token(9, "]");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/CDC.js
var Qn = /* @__PURE__ */ t({
	generate: () => tr,
	name: () => "CDC",
	parse: () => er,
	structure: () => $n
}), $n = [];
function er() {
	let e = this.tokenStart;
	return this.eat(15), {
		type: "CDC",
		loc: this.getLocation(e, this.tokenStart)
	};
}
function tr() {
	this.token(15, "-->");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/CDO.js
var nr = /* @__PURE__ */ t({
	generate: () => ar,
	name: () => "CDO",
	parse: () => ir,
	structure: () => rr
}), rr = [];
function ir() {
	let e = this.tokenStart;
	return this.eat(14), {
		type: "CDO",
		loc: this.getLocation(e, this.tokenStart)
	};
}
function ar() {
	this.token(14, "<!--");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/ClassSelector.js
var or = /* @__PURE__ */ t({
	generate: () => dr,
	name: () => cr,
	parse: () => ur,
	structure: () => lr
}), sr = 46, cr = "ClassSelector", lr = { name: String };
function ur() {
	return this.eatDelim(sr), {
		type: "ClassSelector",
		loc: this.getLocation(this.tokenStart - 1, this.tokenEnd),
		name: this.consume(1)
	};
}
function dr(e) {
	this.token(9, "."), this.token(1, e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Combinator.js
var fr = /* @__PURE__ */ t({
	generate: () => br,
	name: () => _r,
	parse: () => yr,
	structure: () => vr
}), pr = 43, mr = 47, hr = 62, gr = 126, _r = "Combinator", vr = { name: String };
function yr() {
	let e = this.tokenStart, t;
	switch (this.tokenType) {
		case 13:
			t = " ";
			break;
		case 9:
			switch (this.charCodeAt(this.tokenStart)) {
				case hr:
				case pr:
				case gr:
					this.next();
					break;
				case mr:
					this.next(), this.eatIdent("deep"), this.eatDelim(mr);
					break;
				default: this.error("Combinator is expected");
			}
			t = this.substrToCursor(e);
	}
	return {
		type: "Combinator",
		loc: this.getLocation(e, this.tokenStart),
		name: t
	};
}
function br(e) {
	this.tokenize(e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Comment.js
var xr = /* @__PURE__ */ t({
	generate: () => Dr,
	name: () => wr,
	parse: () => Er,
	structure: () => Tr
}), Sr = 42, Cr = 47, wr = "Comment", Tr = { value: String };
function Er() {
	let e = this.tokenStart, t = this.tokenEnd;
	return this.eat(25), t - e + 2 >= 2 && this.charCodeAt(t - 2) === Sr && this.charCodeAt(t - 1) === Cr && (t -= 2), {
		type: "Comment",
		loc: this.getLocation(e, this.tokenStart),
		value: this.substring(e + 2, t)
	};
}
function Dr(e) {
	this.token(25, "/*" + e.value + "*/");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Condition.js
var Or = /* @__PURE__ */ t({
	generate: () => Fr,
	name: () => Ar,
	parse: () => Pr,
	structure: () => jr
}), kr = /* @__PURE__ */ new Set([
	16,
	22,
	0
]), Ar = "Condition", jr = {
	kind: String,
	children: [[
		"Identifier",
		"Feature",
		"FeatureFunction",
		"FeatureRange",
		"SupportsDeclaration"
	]]
};
function Mr(e) {
	return this.lookupTypeNonSC(1) === 1 && kr.has(this.lookupTypeNonSC(2)) ? this.Feature(e) : this.FeatureRange(e);
}
var Nr = {
	media: Mr,
	container: Mr,
	supports() {
		return this.SupportsDeclaration();
	}
};
function Pr(e = "media") {
	let t = this.createList();
	scan: for (; !this.eof;) switch (this.tokenType) {
		case 25:
		case 13:
			this.next();
			continue;
		case 1:
			t.push(this.Identifier());
			break;
		case 21: {
			let n = this.parseWithFallback(() => Nr[e].call(this, e), () => null);
			n || (n = this.parseWithFallback(() => {
				this.eat(21);
				let t = this.Condition(e);
				return this.eat(22), t;
			}, () => this.GeneralEnclosed(e))), t.push(n);
			break;
		}
		case 2: {
			let n = this.parseWithFallback(() => this.FeatureFunction(e), () => null);
			n || (n = this.GeneralEnclosed(e)), t.push(n);
			break;
		}
		default: break scan;
	}
	return t.isEmpty && this.error("Condition is expected"), {
		type: "Condition",
		loc: this.getLocationFromList(t),
		kind: e,
		children: t
	};
}
function Fr(e) {
	e.children.forEach((e) => {
		e.type === "Condition" ? (this.token(21, "("), this.node(e), this.token(22, ")")) : this.node(e);
	});
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Declaration.js
var Ir = /* @__PURE__ */ t({
	generate: () => Zr,
	name: () => qr,
	parse: () => Xr,
	structure: () => Yr,
	walkContext: () => Jr
}), Lr = 33, Rr = 35, zr = 36, Br = 38, Vr = 42, Hr = 43, Ur = 47;
function Wr() {
	return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !0);
}
function Gr() {
	return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !1);
}
function Kr() {
	let e = this.tokenIndex, t = this.Value();
	return t.type !== "Raw" && this.eof === !1 && this.tokenType !== 17 && this.isDelim(Lr) === !1 && this.isBalanceEdge(e) === !1 && this.error(), t;
}
var qr = "Declaration", Jr = "declaration", Yr = {
	important: [Boolean, String],
	property: String,
	value: ["Value", "Raw"]
};
function Xr() {
	let e = this.tokenStart, t = this.tokenIndex, n = Qr.call(this), r = At(n), i = r ? this.parseCustomProperty : this.parseValue, a = r ? Gr : Wr, o = !1, s;
	this.skipSC(), this.eat(16);
	let c = this.tokenIndex;
	if (r || this.skipSC(), s = i ? this.parseWithFallback(Kr, a) : a.call(this, this.tokenIndex), r && s.type === "Value" && s.children.isEmpty) {
		for (let e = c - this.tokenIndex; e <= 0; e++) if (this.lookupType(e) === 13) {
			s.children.appendData({
				type: "WhiteSpace",
				loc: null,
				value: " "
			});
			break;
		}
	}
	return this.isDelim(Lr) && (o = $r.call(this), this.skipSC()), this.eof === !1 && this.tokenType !== 17 && this.isBalanceEdge(t) === !1 && this.error(), {
		type: "Declaration",
		loc: this.getLocation(e, this.tokenStart),
		important: o,
		property: n,
		value: s
	};
}
function Zr(e) {
	this.token(1, e.property), this.token(16, ":"), this.node(e.value), e.important && (this.token(9, "!"), this.token(1, e.important === !0 ? "important" : e.important));
}
function Qr() {
	let e = this.tokenStart;
	if (this.tokenType === 9) switch (this.charCodeAt(this.tokenStart)) {
		case Vr:
		case zr:
		case Hr:
		case Rr:
		case Br:
			this.next();
			break;
		case Ur: this.next(), this.isDelim(Ur) && this.next();
	}
	return this.tokenType === 4 ? this.eat(4) : this.eat(1), this.substrToCursor(e);
}
function $r() {
	this.eat(9), this.skipSC();
	let e = this.consume(1);
	return e === "important" || e;
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/DeclarationList.js
var ei = /* @__PURE__ */ t({
	generate: () => oi,
	name: () => ri,
	parse: () => ai,
	structure: () => ii
}), ti = 38;
function ni() {
	return this.Raw(this.consumeUntilSemicolonIncluded, !0);
}
var ri = "DeclarationList", ii = { children: [[
	"Declaration",
	"Atrule",
	"Rule"
]] };
function ai() {
	let e = this.createList();
	scan: for (; !this.eof;) switch (this.tokenType) {
		case 13:
		case 25:
		case 17:
			this.next();
			break;
		case 3:
			e.push(this.parseWithFallback(this.Atrule.bind(this, !0), ni));
			break;
		default: this.isDelim(ti) ? e.push(this.parseWithFallback(this.Rule, ni)) : e.push(this.parseWithFallback(this.Declaration, ni));
	}
	return {
		type: "DeclarationList",
		loc: this.getLocationFromList(e),
		children: e
	};
}
function oi(e) {
	this.children(e, (e) => {
		e.type === "Declaration" && this.token(17, ";");
	});
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Dimension.js
var si = /* @__PURE__ */ t({
	generate: () => di,
	name: () => ci,
	parse: () => ui,
	structure: () => li
}), ci = "Dimension", li = {
	value: String,
	unit: String
};
function ui() {
	let e = this.tokenStart, t = this.consumeNumber(12);
	return {
		type: "Dimension",
		loc: this.getLocation(e, this.tokenStart),
		value: t,
		unit: this.substring(e + t.length, this.tokenStart)
	};
}
function di(e) {
	this.token(12, e.value + e.unit);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Feature.js
var fi = /* @__PURE__ */ t({
	generate: () => _i,
	name: () => mi,
	parse: () => gi,
	structure: () => hi
}), pi = 47, mi = "Feature", hi = {
	kind: String,
	name: String,
	value: [
		"Identifier",
		"Number",
		"Dimension",
		"Ratio",
		"Function",
		null
	]
};
function gi(e) {
	let t = this.tokenStart, n, r = null;
	if (this.eat(21), this.skipSC(), n = this.consume(1), this.skipSC(), this.tokenType !== 22) {
		switch (this.eat(16), this.skipSC(), this.tokenType) {
			case 10:
				r = this.lookupNonWSType(1) === 9 ? this.Ratio() : this.Number();
				break;
			case 12:
				r = this.Dimension();
				break;
			case 1:
				r = this.Identifier();
				break;
			case 2:
				r = this.parseWithFallback(() => {
					let e = this.Function(this.readSequence, this.scope.Value);
					return this.skipSC(), this.isDelim(pi) && this.error(), e;
				}, () => this.Ratio());
				break;
			default: this.error("Number, dimension, ratio or identifier is expected");
		}
		this.skipSC();
	}
	return this.eof || this.eat(22), {
		type: "Feature",
		loc: this.getLocation(t, this.tokenStart),
		kind: e,
		name: n,
		value: r
	};
}
function _i(e) {
	this.token(21, "("), this.token(1, e.name), e.value !== null && (this.token(16, ":"), this.node(e.value)), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/FeatureFunction.js
var vi = /* @__PURE__ */ t({
	generate: () => Ci,
	name: () => yi,
	parse: () => Si,
	structure: () => bi
}), yi = "FeatureFunction", bi = {
	kind: String,
	feature: String,
	value: ["Declaration", "Selector"]
};
function xi(e, t) {
	let n = (this.features[e] || {})[t];
	return typeof n != "function" && this.error(`Unknown feature ${t}()`), n;
}
function Si(e = "unknown") {
	let t = this.tokenStart, n = this.consumeFunctionName(), r = xi.call(this, e, n.toLowerCase());
	this.skipSC();
	let i = this.parseWithFallback(() => {
		let e = this.tokenIndex, t = r.call(this);
		return this.eof === !1 && this.isBalanceEdge(e) === !1 && this.error(), t;
	}, () => this.Raw(null, !1));
	return this.eof || this.eat(22), {
		type: "FeatureFunction",
		loc: this.getLocation(t, this.tokenStart),
		kind: e,
		feature: n,
		value: i
	};
}
function Ci(e) {
	this.token(2, e.feature + "("), this.node(e.value), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/FeatureRange.js
var wi = /* @__PURE__ */ t({
	generate: () => Pi,
	name: () => ki,
	parse: () => Ni,
	structure: () => Ai
}), Ti = 47, Ei = 60, Di = 61, Oi = 62, ki = "FeatureRange", Ai = {
	kind: String,
	left: [
		"Identifier",
		"Number",
		"Dimension",
		"Ratio",
		"Function"
	],
	leftComparison: String,
	middle: [
		"Identifier",
		"Number",
		"Dimension",
		"Ratio",
		"Function"
	],
	rightComparison: [String, null],
	right: [
		"Identifier",
		"Number",
		"Dimension",
		"Ratio",
		"Function",
		null
	]
};
function ji() {
	switch (this.skipSC(), this.tokenType) {
		case 10: return this.isDelim(Ti, this.lookupOffsetNonSC(1)) ? this.Ratio() : this.Number();
		case 12: return this.Dimension();
		case 1: return this.Identifier();
		case 2: return this.parseWithFallback(() => {
			let e = this.Function(this.readSequence, this.scope.Value);
			return this.skipSC(), this.isDelim(Ti) && this.error(), e;
		}, () => this.Ratio());
		default: this.error("Number, dimension, ratio or identifier is expected");
	}
}
function Mi(e) {
	if (this.skipSC(), this.isDelim(Ei) || this.isDelim(Oi)) {
		let e = this.source[this.tokenStart];
		return this.next(), this.isDelim(Di) ? (this.next(), e + "=") : e;
	}
	if (this.isDelim(Di)) return "=";
	this.error(`Expected ${e ? "\":\", " : ""}"<", ">", "=" or ")"`);
}
function Ni(e = "unknown") {
	let t = this.tokenStart;
	this.skipSC(), this.eat(21);
	let n = ji.call(this), r = Mi.call(this, n.type === "Identifier"), i = ji.call(this), a = null, o = null;
	return this.lookupNonWSType(0) !== 22 && (a = Mi.call(this), o = ji.call(this)), this.skipSC(), this.eat(22), {
		type: "FeatureRange",
		loc: this.getLocation(t, this.tokenStart),
		kind: e,
		left: n,
		leftComparison: r,
		middle: i,
		rightComparison: a,
		right: o
	};
}
function Pi(e) {
	this.token(21, "("), this.node(e.left), this.tokenize(e.leftComparison), this.node(e.middle), e.right && (this.tokenize(e.rightComparison), this.node(e.right)), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Function.js
var Fi = /* @__PURE__ */ t({
	generate: () => Bi,
	name: () => Ii,
	parse: () => zi,
	structure: () => Ri,
	walkContext: () => Li
}), Ii = "Function", Li = "function", Ri = {
	name: String,
	children: [[]]
};
function zi(e, t) {
	let n = this.tokenStart, r = this.consumeFunctionName(), i = r.toLowerCase(), a;
	return a = t.hasOwnProperty(i) ? t[i].call(this, t) : e.call(this, t), this.eof || this.eat(22), {
		type: "Function",
		loc: this.getLocation(n, this.tokenStart),
		name: r,
		children: a
	};
}
function Bi(e) {
	this.token(2, e.name + "("), this.children(e), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/GeneralEnclosed.js
var Vi = /* @__PURE__ */ t({
	generate: () => Gi,
	name: () => Hi,
	parse: () => Wi,
	structure: () => Ui
}), Hi = "GeneralEnclosed", Ui = {
	kind: String,
	function: [String, null],
	children: [[]]
};
function Wi(e) {
	let t = this.tokenStart, n = null;
	this.tokenType === 2 ? n = this.consumeFunctionName() : this.eat(21);
	let r = this.parseWithFallback(() => {
		let e = this.tokenIndex, t = this.readSequence(this.scope.Value);
		return this.eof === !1 && this.isBalanceEdge(e) === !1 && this.error(), t;
	}, () => this.createSingleNodeList(this.Raw(null, !1)));
	return this.eof || this.eat(22), {
		type: "GeneralEnclosed",
		loc: this.getLocation(t, this.tokenStart),
		kind: e,
		function: n,
		children: r
	};
}
function Gi(e) {
	e.function ? this.token(2, e.function + "(") : this.token(21, "("), this.children(e), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Hash.js
var Ki = /* @__PURE__ */ t({
	generate: () => Xi,
	name: () => qi,
	parse: () => Yi,
	structure: () => Ji,
	xxx: () => "XXX"
}), qi = "Hash", Ji = { value: String };
function Yi() {
	let e = this.tokenStart;
	return this.eat(4), {
		type: "Hash",
		loc: this.getLocation(e, this.tokenStart),
		value: this.substrToCursor(e + 1)
	};
}
function Xi(e) {
	this.token(4, "#" + e.value);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Identifier.js
var Zi = /* @__PURE__ */ t({
	generate: () => ta,
	name: () => Qi,
	parse: () => ea,
	structure: () => $i
}), Qi = "Identifier", $i = { name: String };
function ea() {
	return {
		type: "Identifier",
		loc: this.getLocation(this.tokenStart, this.tokenEnd),
		name: this.consume(1)
	};
}
function ta(e) {
	this.token(1, e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/IdSelector.js
var na = /* @__PURE__ */ t({
	generate: () => oa,
	name: () => ra,
	parse: () => aa,
	structure: () => ia
}), ra = "IdSelector", ia = { name: String };
function aa() {
	let e = this.tokenStart;
	return this.eat(4), {
		type: "IdSelector",
		loc: this.getLocation(e, this.tokenStart),
		name: this.substrToCursor(e + 1)
	};
}
function oa(e) {
	this.token(9, "#" + e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Layer.js
var sa = /* @__PURE__ */ t({
	generate: () => fa,
	name: () => la,
	parse: () => da,
	structure: () => ua
}), ca = 46, la = "Layer", ua = { name: String };
function da() {
	let e = this.tokenStart, t = this.consume(1);
	for (; this.isDelim(ca);) this.eat(9), t += "." + this.consume(1);
	return {
		type: "Layer",
		loc: this.getLocation(e, this.tokenStart),
		name: t
	};
}
function fa(e) {
	this.tokenize(e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/LayerList.js
var pa = /* @__PURE__ */ t({
	generate: () => _a,
	name: () => ma,
	parse: () => ga,
	structure: () => ha
}), ma = "LayerList", ha = { children: [["Layer"]] };
function ga() {
	let e = this.createList();
	for (this.skipSC(); !this.eof && (e.push(this.Layer()), this.lookupTypeNonSC(0) === 18);) this.skipSC(), this.next(), this.skipSC();
	return {
		type: "LayerList",
		loc: this.getLocationFromList(e),
		children: e
	};
}
function _a(e) {
	this.children(e, () => this.token(18, ","));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/MediaQuery.js
var va = /* @__PURE__ */ t({
	generate: () => Sa,
	name: () => ya,
	parse: () => xa,
	structure: () => ba
}), ya = "MediaQuery", ba = {
	modifier: [String, null],
	mediaType: [String, null],
	condition: ["Condition", null]
};
function xa() {
	let e = this.tokenStart, t = null, n = null, r = null;
	if (this.skipSC(), this.tokenType === 1 && this.lookupTypeNonSC(1) !== 21) {
		let e = this.consume(1), i = e.toLowerCase();
		switch (i === "not" || i === "only" ? (this.skipSC(), t = i, n = this.consume(1)) : n = e, this.lookupTypeNonSC(0)) {
			case 1:
				this.skipSC(), this.eatIdent("and"), r = this.Condition("media");
				break;
			case 23:
			case 17:
			case 18:
			case 0: break;
			default: this.error("Identifier or parenthesis is expected");
		}
	} else switch (this.tokenType) {
		case 1:
		case 21:
		case 2:
			r = this.Condition("media");
			break;
		case 23:
		case 17:
		case 0: break;
		default: this.error("Identifier or parenthesis is expected");
	}
	return {
		type: "MediaQuery",
		loc: this.getLocation(e, this.tokenStart),
		modifier: t,
		mediaType: n,
		condition: r
	};
}
function Sa(e) {
	e.mediaType ? (e.modifier && this.token(1, e.modifier), this.token(1, e.mediaType), e.condition && (this.token(1, "and"), this.node(e.condition))) : e.condition && this.node(e.condition);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/MediaQueryList.js
var Ca = /* @__PURE__ */ t({
	generate: () => Da,
	name: () => wa,
	parse: () => Ea,
	structure: () => Ta
}), wa = "MediaQueryList", Ta = { children: [["MediaQuery"]] };
function Ea() {
	let e = this.createList();
	for (this.skipSC(); !this.eof && (e.push(this.MediaQuery()), this.tokenType === 18);) this.next();
	return {
		type: "MediaQueryList",
		loc: this.getLocationFromList(e),
		children: e
	};
}
function Da(e) {
	this.children(e, () => this.token(18, ","));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/NestingSelector.js
var Oa = /* @__PURE__ */ t({
	generate: () => Na,
	name: () => Aa,
	parse: () => Ma,
	structure: () => ja
}), ka = 38, Aa = "NestingSelector", ja = {};
function Ma() {
	let e = this.tokenStart;
	return this.eatDelim(ka), {
		type: "NestingSelector",
		loc: this.getLocation(e, this.tokenStart)
	};
}
function Na() {
	this.token(9, "&");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Nth.js
var Pa = /* @__PURE__ */ t({
	generate: () => La,
	name: () => "Nth",
	parse: () => Ia,
	structure: () => Fa
}), Fa = {
	nth: ["AnPlusB", "Identifier"],
	selector: ["SelectorList", null]
};
function Ia() {
	this.skipSC();
	let e = this.tokenStart, t = e, n = null, r;
	return r = this.lookupValue(0, "odd") || this.lookupValue(0, "even") ? this.Identifier() : this.AnPlusB(), t = this.tokenStart, this.skipSC(), this.lookupValue(0, "of") && (this.next(), n = this.SelectorList(), t = this.tokenStart), {
		type: "Nth",
		loc: this.getLocation(e, t),
		nth: r,
		selector: n
	};
}
function La(e) {
	this.node(e.nth), e.selector !== null && (this.token(1, "of"), this.node(e.selector));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Number.js
var Ra = /* @__PURE__ */ t({
	generate: () => Ha,
	name: () => za,
	parse: () => Va,
	structure: () => Ba
}), za = "Number", Ba = { value: String };
function Va() {
	return {
		type: "Number",
		loc: this.getLocation(this.tokenStart, this.tokenEnd),
		value: this.consume(10)
	};
}
function Ha(e) {
	this.token(10, e.value);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Operator.js
var Ua = /* @__PURE__ */ t({
	generate: () => qa,
	name: () => Wa,
	parse: () => Ka,
	structure: () => Ga
}), Wa = "Operator", Ga = { value: String };
function Ka() {
	let e = this.tokenStart;
	return this.next(), {
		type: "Operator",
		loc: this.getLocation(e, this.tokenStart),
		value: this.substrToCursor(e)
	};
}
function qa(e) {
	this.tokenize(e.value);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Parentheses.js
var Ja = /* @__PURE__ */ t({
	generate: () => Qa,
	name: () => Ya,
	parse: () => Za,
	structure: () => Xa
}), Ya = "Parentheses", Xa = { children: [[]] };
function Za(e, t) {
	let n = this.tokenStart, r = null;
	return this.eat(21), r = e.call(this, t), this.eof || this.eat(22), {
		type: "Parentheses",
		loc: this.getLocation(n, this.tokenStart),
		children: r
	};
}
function Qa(e) {
	this.token(21, "("), this.children(e), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Percentage.js
var $a = /* @__PURE__ */ t({
	generate: () => ro,
	name: () => eo,
	parse: () => no,
	structure: () => to
}), eo = "Percentage", to = { value: String };
function no() {
	return {
		type: "Percentage",
		loc: this.getLocation(this.tokenStart, this.tokenEnd),
		value: this.consumeNumber(11)
	};
}
function ro(e) {
	this.token(11, e.value + "%");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/PseudoClassSelector.js
var io = /* @__PURE__ */ t({
	generate: () => lo,
	name: () => ao,
	parse: () => co,
	structure: () => so,
	walkContext: () => oo
}), ao = "PseudoClassSelector", oo = "function", so = {
	name: String,
	children: [["Raw"], null]
};
function co() {
	let e = this.tokenStart, t = null, n, r;
	return this.eat(16), this.tokenType === 2 ? (n = this.consumeFunctionName(), r = n.toLowerCase(), this.lookupNonWSType(0) == 22 ? t = this.createList() : hasOwnProperty.call(this.pseudo, r) ? (this.skipSC(), t = this.pseudo[r].call(this), this.skipSC()) : (t = this.createList(), t.push(this.Raw(null, !1))), this.eat(22)) : n = this.consume(1), {
		type: "PseudoClassSelector",
		loc: this.getLocation(e, this.tokenStart),
		name: n,
		children: t
	};
}
function lo(e) {
	this.token(16, ":"), e.children === null ? this.token(1, e.name) : (this.token(2, e.name + "("), this.children(e), this.token(22, ")"));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/PseudoElementSelector.js
var uo = /* @__PURE__ */ t({
	generate: () => go,
	name: () => fo,
	parse: () => ho,
	structure: () => mo,
	walkContext: () => po
}), fo = "PseudoElementSelector", po = "function", mo = {
	name: String,
	children: [["Raw"], null]
};
function ho() {
	let e = this.tokenStart, t = null, n, r;
	return this.eat(16), this.eat(16), this.tokenType === 2 ? (n = this.consumeFunctionName(), r = n.toLowerCase(), this.lookupNonWSType(0) == 22 ? t = this.createList() : hasOwnProperty.call(this.pseudo, r) ? (this.skipSC(), t = this.pseudo[r].call(this), this.skipSC()) : (t = this.createList(), t.push(this.Raw(null, !1))), this.eat(22)) : n = this.consume(1), {
		type: "PseudoElementSelector",
		loc: this.getLocation(e, this.tokenStart),
		name: n,
		children: t
	};
}
function go(e) {
	this.token(16, ":"), this.token(16, ":"), e.children === null ? this.token(1, e.name) : (this.token(2, e.name + "("), this.children(e), this.token(22, ")"));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Ratio.js
var _o = /* @__PURE__ */ t({
	generate: () => Co,
	name: () => bo,
	parse: () => So,
	structure: () => xo
}), vo = 47;
function yo() {
	switch (this.skipSC(), this.tokenType) {
		case 10: return this.Number();
		case 2: return this.Function(this.readSequence, this.scope.Value);
		default: this.error("Number of function is expected");
	}
}
var bo = "Ratio", xo = {
	left: ["Number", "Function"],
	right: [
		"Number",
		"Function",
		null
	]
};
function So() {
	let e = this.tokenStart, t = yo.call(this), n = null;
	return this.skipSC(), this.isDelim(vo) && (this.eatDelim(vo), n = yo.call(this)), {
		type: "Ratio",
		loc: this.getLocation(e, this.tokenStart),
		left: t,
		right: n
	};
}
function Co(e) {
	this.node(e.left), this.token(9, "/"), e.right ? this.node(e.right) : this.node(10, 1);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Raw.js
var wo = /* @__PURE__ */ t({
	generate: () => Oo,
	name: () => "Raw",
	parse: () => Do,
	structure: () => Eo
});
function To() {
	return this.tokenIndex > 0 && this.lookupType(-1) === 13 ? this.tokenIndex > 1 ? this.getTokenStart(this.tokenIndex - 1) : this.firstCharOffset : this.tokenStart;
}
var Eo = { value: String };
function Do(e, t) {
	let n = this.getTokenStart(this.tokenIndex), r;
	return this.skipUntilBalanced(this.tokenIndex, e || this.consumeUntilBalanceEnd), r = t && this.tokenStart > n ? To.call(this) : this.tokenStart, {
		type: "Raw",
		loc: this.getLocation(n, r),
		value: this.substring(n, r)
	};
}
function Oo(e) {
	this.tokenize(e.value);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Rule.js
var ko = /* @__PURE__ */ t({
	generate: () => Io,
	name: () => Mo,
	parse: () => Fo,
	structure: () => Po,
	walkContext: () => No
});
function Ao() {
	return this.Raw(this.consumeUntilLeftCurlyBracket, !0);
}
function jo() {
	let e = this.SelectorList();
	return e.type !== "Raw" && this.eof === !1 && this.tokenType !== 23 && this.error(), e;
}
var Mo = "Rule", No = "rule", Po = {
	prelude: ["SelectorList", "Raw"],
	block: ["Block"]
};
function Fo() {
	let e = this.tokenIndex, t = this.tokenStart, n, r;
	return n = this.parseRulePrelude ? this.parseWithFallback(jo, Ao) : Ao.call(this, e), r = this.Block(!0), {
		type: "Rule",
		loc: this.getLocation(t, this.tokenStart),
		prelude: n,
		block: r
	};
}
function Io(e) {
	this.node(e.prelude), this.node(e.block);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Scope.js
var Lo = /* @__PURE__ */ t({
	generate: () => Vo,
	name: () => Ro,
	parse: () => Bo,
	structure: () => zo
}), Ro = "Scope", zo = {
	root: [
		"SelectorList",
		"Raw",
		null
	],
	limit: [
		"SelectorList",
		"Raw",
		null
	]
};
function Bo() {
	let e = null, t = null;
	this.skipSC();
	let n = this.tokenStart;
	return this.tokenType === 21 && (this.next(), this.skipSC(), e = this.parseWithFallback(this.SelectorList, () => this.Raw(!1, !0)), this.skipSC(), this.eat(22)), this.lookupNonWSType(0) === 1 && (this.skipSC(), this.eatIdent("to"), this.skipSC(), this.eat(21), this.skipSC(), t = this.parseWithFallback(this.SelectorList, () => this.Raw(!1, !0)), this.skipSC(), this.eat(22)), {
		type: "Scope",
		loc: this.getLocation(n, this.tokenStart),
		root: e,
		limit: t
	};
}
function Vo(e) {
	e.root && (this.token(21, "("), this.node(e.root), this.token(22, ")")), e.limit && (this.token(1, "to"), this.token(21, "("), this.node(e.limit), this.token(22, ")"));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Selector.js
var Ho = /* @__PURE__ */ t({
	generate: () => Ko,
	name: () => Uo,
	parse: () => Go,
	structure: () => Wo
}), Uo = "Selector", Wo = { children: [[
	"TypeSelector",
	"IdSelector",
	"ClassSelector",
	"AttributeSelector",
	"PseudoClassSelector",
	"PseudoElementSelector",
	"Combinator"
]] };
function Go() {
	let e = this.readSequence(this.scope.Selector);
	return this.getFirstListNode(e) === null && this.error("Selector is expected"), {
		type: "Selector",
		loc: this.getLocationFromList(e),
		children: e
	};
}
function Ko(e) {
	this.children(e);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/SelectorList.js
var qo = /* @__PURE__ */ t({
	generate: () => Qo,
	name: () => Jo,
	parse: () => Zo,
	structure: () => Xo,
	walkContext: () => Yo
}), Jo = "SelectorList", Yo = "selector", Xo = { children: [["Selector", "Raw"]] };
function Zo() {
	let e = this.createList();
	for (; !this.eof;) {
		if (e.push(this.Selector()), this.tokenType === 18) {
			this.next();
			continue;
		}
		break;
	}
	return {
		type: "SelectorList",
		loc: this.getLocationFromList(e),
		children: e
	};
}
function Qo(e) {
	this.children(e, () => this.token(18, ","));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/String.js
var $o = /* @__PURE__ */ t({
	generate: () => rs,
	name: () => es,
	parse: () => ns,
	structure: () => ts
}), es = "String", ts = { value: String };
function ns() {
	return {
		type: "String",
		loc: this.getLocation(this.tokenStart, this.tokenEnd),
		value: Pt(this.consume(5))
	};
}
function rs(e) {
	this.token(5, Ft(e.value));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/StyleSheet.js
var is = /* @__PURE__ */ t({
	generate: () => ds,
	name: () => ss,
	parse: () => us,
	structure: () => ls,
	walkContext: () => cs
}), as = 33;
function os() {
	return this.Raw(null, !1);
}
var ss = "StyleSheet", cs = "stylesheet", ls = { children: [[
	"Comment",
	"CDO",
	"CDC",
	"Atrule",
	"Rule",
	"Raw"
]] };
function us() {
	let e = this.tokenStart, t = this.createList(), n;
	scan: for (; !this.eof;) {
		switch (this.tokenType) {
			case 13:
				this.next();
				continue;
			case 25:
				if (this.charCodeAt(this.tokenStart + 2) !== as) {
					this.next();
					continue;
				}
				n = this.Comment();
				break;
			case 14:
				n = this.CDO();
				break;
			case 15:
				n = this.CDC();
				break;
			case 3:
				n = this.parseWithFallback(this.Atrule, os);
				break;
			default: n = this.parseWithFallback(this.Rule, os);
		}
		t.push(n);
	}
	return {
		type: "StyleSheet",
		loc: this.getLocation(e, this.tokenStart),
		children: t
	};
}
function ds(e) {
	this.children(e);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/SupportsDeclaration.js
var fs = /* @__PURE__ */ t({
	generate: () => gs,
	name: () => ps,
	parse: () => hs,
	structure: () => ms
}), ps = "SupportsDeclaration", ms = { declaration: "Declaration" };
function hs() {
	let e = this.tokenStart;
	this.eat(21), this.skipSC();
	let t = this.Declaration();
	return this.eof || this.eat(22), {
		type: "SupportsDeclaration",
		loc: this.getLocation(e, this.tokenStart),
		declaration: t
	};
}
function gs(e) {
	this.token(21, "("), this.node(e.declaration), this.token(22, ")");
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/TypeSelector.js
var _s = /* @__PURE__ */ t({
	generate: () => ws,
	name: () => xs,
	parse: () => Cs,
	structure: () => Ss
}), vs = 42, ys = 124;
function bs() {
	this.tokenType !== 1 && this.isDelim(vs) === !1 && this.error("Identifier or asterisk is expected"), this.next();
}
var xs = "TypeSelector", Ss = { name: String };
function Cs() {
	let e = this.tokenStart;
	return this.isDelim(ys) ? (this.next(), bs.call(this)) : (bs.call(this), this.isDelim(ys) && (this.next(), bs.call(this))), {
		type: "TypeSelector",
		loc: this.getLocation(e, this.tokenStart),
		name: this.substrToCursor(e)
	};
}
function ws(e) {
	this.tokenize(e.name);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/UnicodeRange.js
var Ts = /* @__PURE__ */ t({
	generate: () => Is,
	name: () => Ns,
	parse: () => Fs,
	structure: () => Ps
}), Es = 43, Ds = 45, Os = 63;
function ks(e, t) {
	let n = 0;
	for (let r = this.tokenStart + e; r < this.tokenEnd; r++) {
		let i = this.charCodeAt(r);
		if (i === Ds && t && n !== 0) return ks.call(this, e + n + 1, !1), -1;
		Ge(i) || this.error(t && n !== 0 ? "Hyphen minus" + (n < 6 ? " or hex digit" : "") + " is expected" : n < 6 ? "Hex digit is expected" : "Unexpected input", r), ++n > 6 && this.error("Too many hex digits", r);
	}
	return this.next(), n;
}
function As(e) {
	let t = 0;
	for (; this.isDelim(Os);) ++t > e && this.error("Too many question marks"), this.next();
}
function js(e) {
	this.charCodeAt(this.tokenStart) !== e && this.error((e === Es ? "Plus sign" : "Hyphen minus") + " is expected");
}
function Ms() {
	let e = 0;
	switch (this.tokenType) {
		case 10:
			if (e = ks.call(this, 1, !0), this.isDelim(Os)) {
				As.call(this, 6 - e);
				break;
			}
			if (this.tokenType === 12 || this.tokenType === 10) {
				js.call(this, Ds), ks.call(this, 1, !1);
				break;
			}
			break;
		case 12:
			e = ks.call(this, 1, !0), e > 0 && As.call(this, 6 - e);
			break;
		default:
			if (this.eatDelim(Es), this.tokenType === 1) {
				e = ks.call(this, 0, !0), e > 0 && As.call(this, 6 - e);
				break;
			}
			if (this.isDelim(Os)) {
				this.next(), As.call(this, 5);
				break;
			}
			this.error("Hex digit or question mark is expected");
	}
}
var Ns = "UnicodeRange", Ps = { value: String };
function Fs() {
	let e = this.tokenStart;
	return this.eatIdent("u"), Ms.call(this), {
		type: "UnicodeRange",
		loc: this.getLocation(e, this.tokenStart),
		value: this.substrToCursor(e)
	};
}
function Is(e) {
	this.tokenize(e.value);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Url.js
var Ls = /* @__PURE__ */ t({
	generate: () => Bs,
	name: () => "Url",
	parse: () => zs,
	structure: () => Rs
}), Rs = { value: String };
function zs() {
	let e = this.tokenStart, t;
	switch (this.tokenType) {
		case 7:
			t = Ht(this.consume(7));
			break;
		case 2:
			this.cmpStr(this.tokenStart, this.tokenEnd, "url(") || this.error("Function name must be `url`"), this.eat(2), this.skipSC(), t = Pt(this.consume(5)), this.skipSC(), this.eof || this.eat(22);
			break;
		default: this.error("Url or Function is expected");
	}
	return {
		type: "Url",
		loc: this.getLocation(e, this.tokenStart),
		value: t
	};
}
function Bs(e) {
	this.token(7, Ut(e.value));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/Value.js
var Vs = /* @__PURE__ */ t({
	generate: () => Gs,
	name: () => Hs,
	parse: () => Ws,
	structure: () => Us
}), Hs = "Value", Us = { children: [[]] };
function Ws() {
	let e = this.tokenStart, t = this.readSequence(this.scope.Value);
	return {
		type: "Value",
		loc: this.getLocation(e, this.tokenStart),
		children: t
	};
}
function Gs(e) {
	this.children(e);
}
//#endregion
//#region node_modules/css-tree/lib/syntax/node/WhiteSpace.js
var Ks = /* @__PURE__ */ t({
	generate: () => Zs,
	name: () => Js,
	parse: () => Xs,
	structure: () => Ys
}), qs = Object.freeze({
	type: "WhiteSpace",
	loc: null,
	value: " "
}), Js = "WhiteSpace", Ys = { value: String };
function Xs() {
	return this.eat(13), qs;
}
function Zs(e) {
	this.token(13, e.value);
}
//#endregion
//#region node_modules/css-tree/lib/walker/index.js
var H = Qt({ node: /* @__PURE__ */ t({
	AnPlusB: () => $t,
	Atrule: () => ln,
	AtrulePrelude: () => _n,
	AttributeSelector: () => Cn,
	Block: () => In,
	Brackets: () => qn,
	CDC: () => Qn,
	CDO: () => nr,
	ClassSelector: () => or,
	Combinator: () => fr,
	Comment: () => xr,
	Condition: () => Or,
	Declaration: () => Ir,
	DeclarationList: () => ei,
	Dimension: () => si,
	Feature: () => fi,
	FeatureFunction: () => vi,
	FeatureRange: () => wi,
	Function: () => Fi,
	GeneralEnclosed: () => Vi,
	Hash: () => Ki,
	IdSelector: () => na,
	Identifier: () => Zi,
	Layer: () => sa,
	LayerList: () => pa,
	MediaQuery: () => va,
	MediaQueryList: () => Ca,
	NestingSelector: () => Oa,
	Nth: () => Pa,
	Number: () => Ra,
	Operator: () => Ua,
	Parentheses: () => Ja,
	Percentage: () => $a,
	PseudoClassSelector: () => io,
	PseudoElementSelector: () => uo,
	Ratio: () => _o,
	Raw: () => wo,
	Rule: () => ko,
	Scope: () => Lo,
	Selector: () => Ho,
	SelectorList: () => qo,
	String: () => $o,
	StyleSheet: () => is,
	SupportsDeclaration: () => fs,
	TypeSelector: () => _s,
	UnicodeRange: () => Ts,
	Url: () => Ls,
	Value: () => Vs,
	WhiteSpace: () => Ks
}) }), Qs = [
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
function $s(e) {
	return Qs.includes(e);
}
var ec = [
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
function tc(e) {
	return ec.includes(e);
}
var nc = [
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
function rc(e) {
	return nc.includes(e);
}
var ic = [
	"padding",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"padding-block",
	"padding-inline",
	"padding-block-start",
	"padding-block-end",
	"padding-inline-start",
	"padding-inline-end"
], ac = [
	"justify-self",
	"align-self",
	"place-self"
];
function oc(e) {
	return ac.includes(e);
}
var sc = [
	...Qs,
	...ec,
	...nc,
	...ac,
	"position-anchor",
	"position-area"
], cc = [
	...nc,
	...Qs,
	...ec
];
function lc(e) {
	return cc.includes(e);
}
var uc = [
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
function dc(e) {
	return uc.includes(e);
}
var fc = [
	"width",
	"height",
	"block",
	"inline",
	"self-block",
	"self-inline"
];
function pc(e) {
	return fc.includes(e);
}
//#endregion
//#region node_modules/css-tree/lib/generator/sourceMap.js
var mc = /* @__PURE__ */ new Set([
	"Atrule",
	"Selector",
	"Declaration"
]);
function hc(e) {
	let t = new SourceMapGenerator(), n = {
		line: 1,
		column: 0
	}, r = {
		line: 0,
		column: 0
	}, i = {
		line: 1,
		column: 0
	}, a = { generated: i }, o = 1, s = 0, c = !1, l = e.node;
	e.node = function(e) {
		if (e.loc && e.loc.start && mc.has(e.type)) {
			let l = e.loc.start.line, u = e.loc.start.column - 1;
			(r.line !== l || r.column !== u) && (r.line = l, r.column = u, n.line = o, n.column = s, c && (c = !1, (n.line !== i.line || n.column !== i.column) && t.addMapping(a)), c = !0, t.addMapping({
				source: e.loc.source,
				original: r,
				generated: n
			}));
		}
		l.call(this, e), c && mc.has(e.type) && (i.line = o, i.column = s);
	};
	let u = e.emit;
	e.emit = function(e, t, n) {
		for (let t = 0; t < e.length; t++) e.charCodeAt(t) === 10 ? (o++, s = 0) : s++;
		u(e, t, n);
	};
	let d = e.result;
	return e.result = function() {
		return c && t.addMapping(a), {
			css: d(),
			map: t
		};
	}, e;
}
//#endregion
//#region node_modules/css-tree/lib/generator/token-before.js
var gc = /* @__PURE__ */ t({
	safe: () => wc,
	spec: () => Cc
}), _c = 43, vc = 45, yc = (e, t) => (e === 9 && (e = t), typeof e == "string" && (e = Math.min(e.charCodeAt(0), 128) << 6), e << 1), bc = [
	[1, 1],
	[1, 2],
	[1, 7],
	[1, 8],
	[1, "-"],
	[1, 10],
	[1, 11],
	[1, 12],
	[1, 15],
	[1, 21],
	[3, 1],
	[3, 2],
	[3, 7],
	[3, 8],
	[3, "-"],
	[3, 10],
	[3, 11],
	[3, 12],
	[3, 15],
	[4, 1],
	[4, 2],
	[4, 7],
	[4, 8],
	[4, "-"],
	[4, 10],
	[4, 11],
	[4, 12],
	[4, 15],
	[12, 1],
	[12, 2],
	[12, 7],
	[12, 8],
	[12, "-"],
	[12, 10],
	[12, 11],
	[12, 12],
	[12, 15],
	["#", 1],
	["#", 2],
	["#", 7],
	["#", 8],
	["#", "-"],
	["#", 10],
	["#", 11],
	["#", 12],
	["#", 15],
	["-", 1],
	["-", 2],
	["-", 7],
	["-", 8],
	["-", "-"],
	["-", 10],
	["-", 11],
	["-", 12],
	["-", 15],
	[10, 1],
	[10, 2],
	[10, 7],
	[10, 8],
	[10, 10],
	[10, 11],
	[10, 12],
	[10, "%"],
	[10, 15],
	["@", 1],
	["@", 2],
	["@", 7],
	["@", 8],
	["@", "-"],
	["@", 15],
	[".", 10],
	[".", 11],
	[".", 12],
	["+", 10],
	["+", 11],
	["+", 12],
	["/", "*"]
], xc = bc.concat([
	[1, 4],
	[12, 4],
	[4, 4],
	[3, 21],
	[3, 5],
	[3, 16],
	[11, 11],
	[11, 12],
	[11, 2],
	[11, "-"],
	[22, 1],
	[22, 2],
	[22, 11],
	[22, 12],
	[22, 4],
	[22, "-"]
]);
function Sc(e) {
	let t = new Set(e.map(([e, t]) => yc(e) << 16 | yc(t)));
	return function(e, n, r) {
		let i = yc(n, r), a = r.charCodeAt(0);
		return i | (a === vc && n !== 1 && n !== 2 && n !== 15 || a === _c ? t.has((e & 65534) << 16 | a << 7) : t.has((e & 65534) << 16 | i));
	};
}
var Cc = Sc(bc), wc = Sc(xc), Tc = 92;
function Ec(e, t) {
	if (typeof t == "function") {
		let n = null;
		e.children.forEach((e) => {
			n !== null && t.call(this, n), this.node(e), n = e;
		});
		return;
	}
	e.children.forEach(this.node, this);
}
function Dc(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of Object.entries(e.node)) typeof (r.generate || r) == "function" && t.set(n, r.generate || r);
	return function(e, n) {
		let r = "", i = 0, a = {
			node(e) {
				if (t.has(e.type)) t.get(e.type).call(o, e);
				else throw Error("Unknown node type: " + e.type);
			},
			tokenBefore: wc,
			token(e, t, n) {
				i = this.tokenBefore(i, e, t), !n && i & 1 && this.emit(" ", 13, !0), this.emit(t, e, !1), e === 9 && t.charCodeAt(0) === Tc && this.emit("\n", 13, !0);
			},
			emit(e) {
				r += e;
			},
			result() {
				return r;
			}
		};
		n && (typeof n.decorator == "function" && (a = n.decorator(a)), n.sourceMap && (a = hc(a)), n.mode in gc && (a.tokenBefore = gc[n.mode]));
		let o = {
			node: (e) => a.node(e),
			children: Ec,
			token: (e, t) => a.token(e, t),
			tokenize: (e) => Ot(e, (t, n, r) => {
				a.token(t, e.slice(n, r), n !== 0);
			})
		};
		return a.node(e), a.result();
	};
}
//#endregion
//#region node_modules/css-tree/lib/generator/index.js
var Oc = Dc({ node: /* @__PURE__ */ t({
	AnPlusB: () => cn,
	Atrule: () => gn,
	AtrulePrelude: () => Sn,
	AttributeSelector: () => Fn,
	Block: () => Kn,
	Brackets: () => Zn,
	CDC: () => tr,
	CDO: () => ar,
	ClassSelector: () => dr,
	Combinator: () => br,
	Comment: () => Dr,
	Condition: () => Fr,
	Declaration: () => Zr,
	DeclarationList: () => oi,
	Dimension: () => di,
	Feature: () => _i,
	FeatureFunction: () => Ci,
	FeatureRange: () => Pi,
	Function: () => Bi,
	GeneralEnclosed: () => Gi,
	Hash: () => Xi,
	IdSelector: () => oa,
	Identifier: () => ta,
	Layer: () => fa,
	LayerList: () => _a,
	MediaQuery: () => Sa,
	MediaQueryList: () => Da,
	NestingSelector: () => Na,
	Nth: () => La,
	Number: () => Ha,
	Operator: () => qa,
	Parentheses: () => Qa,
	Percentage: () => ro,
	PseudoClassSelector: () => lo,
	PseudoElementSelector: () => go,
	Ratio: () => Co,
	Raw: () => Oo,
	Rule: () => Io,
	Scope: () => Vo,
	Selector: () => Ko,
	SelectorList: () => Qo,
	String: () => rs,
	StyleSheet: () => ds,
	SupportsDeclaration: () => gs,
	TypeSelector: () => ws,
	UnicodeRange: () => Is,
	Url: () => Bs,
	Value: () => Gs,
	WhiteSpace: () => Zs
}) });
//#endregion
//#region node_modules/css-tree/lib/utils/create-custom-error.js
function kc(e, t) {
	let n = Object.create(SyntaxError.prototype), r = /* @__PURE__ */ Error();
	return Object.assign(n, {
		name: e,
		message: t,
		get stack() {
			return (r.stack || "").replace(/^(.+\n){1,3}/, `${e}: ${t}\n`);
		}
	});
}
//#endregion
//#region node_modules/css-tree/lib/parser/SyntaxError.js
var Ac = 100, jc = 60, Mc = "    ";
function Nc({ source: e, line: t, column: n, baseLine: r, baseColumn: i }, a) {
	function o(e, t) {
		return s.slice(e, t).map((t, n) => String(e + n + 1).padStart(u) + " |" + t).join("\n");
	}
	let s = ("\n".repeat(Math.max(r - 1, 0)) + " ".repeat(Math.max(i - 1, 0)) + e).split(/\r\n?|\n|\f/), c = Math.max(1, t - a) - 1, l = Math.min(t + a, s.length + 1), u = Math.max(4, String(l).length) + 1, d = 0;
	n += 3 * (s[t - 1].substr(0, n - 1).match(/\t/g) || []).length, n > Ac && (d = n - jc + 3, n = 58);
	for (let e = c; e <= l; e++) e >= 0 && e < s.length && (s[e] = s[e].replace(/\t/g, Mc), s[e] = (d > 0 && s[e].length > d ? "…" : "") + s[e].substr(d, 98) + (s[e].length > d + Ac - 1 ? "…" : ""));
	return [
		o(c, t),
		Array(n + u + 2).join("-") + "^",
		o(t, l)
	].filter(Boolean).join("\n").replace(/^(\s+\d+\s+\|\n)+/, "").replace(/\n(\s+\d+\s+\|)+$/, "");
}
function Pc(e, t, n, r, i, a = 1, o = 1) {
	return Object.assign(kc("SyntaxError", e), {
		source: t,
		offset: n,
		line: r,
		column: i,
		sourceFragment(e) {
			return Nc({
				source: t,
				line: r,
				column: i,
				baseLine: a,
				baseColumn: o
			}, isNaN(e) ? 0 : e);
		},
		get formattedMessage() {
			return `Parse error: ${e}\n` + Nc({
				source: t,
				line: r,
				column: i,
				baseLine: a,
				baseColumn: o
			}, 2);
		}
	});
}
//#endregion
//#region node_modules/css-tree/lib/parser/sequence.js
function Fc(e) {
	let t = this.createList(), n = !1, r = { recognizer: e };
	for (; !this.eof;) {
		switch (this.tokenType) {
			case 25:
				this.next();
				continue;
			case 13:
				n = !0, this.next();
				continue;
		}
		let i = e.getNode.call(this, r);
		if (i === void 0) break;
		n && (e.onWhiteSpace && e.onWhiteSpace.call(this, i, t, r), n = !1), t.push(i);
	}
	return n && e.onWhiteSpace && e.onWhiteSpace.call(this, null, t, r), t;
}
//#endregion
//#region node_modules/css-tree/lib/parser/create.js
var Ic = () => {}, Lc = 33, Rc = 35, zc = 59, Bc = 123, Vc = 0, Hc = {
	createList() {
		return [];
	},
	createSingleNodeList(e) {
		return [e];
	},
	getFirstListNode(e) {
		return e && e[0] || null;
	},
	getLastListNode(e) {
		return e && e.length > 0 ? e[e.length - 1] : null;
	}
}, Uc = {
	createList() {
		return new He();
	},
	createSingleNodeList(e) {
		return new He().appendData(e);
	},
	getFirstListNode(e) {
		return e && e.first;
	},
	getLastListNode(e) {
		return e && e.last;
	}
};
function Wc(e) {
	return function() {
		return this[e]();
	};
}
function Gc(e) {
	let t = Object.create(null);
	for (let n of Object.keys(e)) {
		let r = e[n], i = r.parse || r;
		i && (t[n] = i);
	}
	return t;
}
function Kc(e) {
	let t = {
		context: Object.create(null),
		features: Object.assign(Object.create(null), e.features),
		scope: Object.assign(Object.create(null), e.scope),
		atrule: Gc(e.atrule),
		pseudo: Gc(e.pseudo),
		node: Gc(e.node)
	};
	for (let [n, r] of Object.entries(e.parseContext)) switch (typeof r) {
		case "function":
			t.context[n] = r;
			break;
		case "string": t.context[n] = Wc(r);
	}
	return h(h({ config: t }, t), t.node);
}
function qc(e) {
	let t = "", n = "<unknown>", r = !1, i = Ic, a = !1, o = new Ct(), s = Object.assign(new Dt(), Kc(e || {}), {
		parseAtrulePrelude: !0,
		parseRulePrelude: !0,
		parseValue: !0,
		parseCustomProperty: !1,
		readSequence: Fc,
		consumeUntilBalanceEnd: () => 0,
		consumeUntilLeftCurlyBracket(e) {
			return +(e === Bc);
		},
		consumeUntilLeftCurlyBracketOrSemicolon(e) {
			return +(e === Bc || e === zc);
		},
		consumeUntilExclamationMarkOrSemicolon(e) {
			return +(e === Lc || e === zc);
		},
		consumeUntilSemicolonIncluded(e) {
			return e === zc ? 2 : 0;
		},
		createList: Ic,
		createSingleNodeList: Ic,
		getFirstListNode: Ic,
		getLastListNode: Ic,
		parseWithFallback(e, t) {
			let n = this.tokenIndex;
			try {
				return e.call(this);
			} catch (e) {
				if (a) throw e;
				this.skip(n - this.tokenIndex);
				let r = t.call(this);
				return a = !0, i(e, r), a = !1, r;
			}
		},
		lookupNonWSType(e) {
			let t;
			do
				if (t = this.lookupType(e++), t !== 13 && t !== 25) return t;
			while (t !== Vc);
			return Vc;
		},
		charCodeAt(e) {
			return e >= 0 && e < t.length ? t.charCodeAt(e) : 0;
		},
		substring(e, n) {
			return t.substring(e, n);
		},
		substrToCursor(e) {
			return this.source.substring(e, this.tokenStart);
		},
		cmpChar(e, n) {
			return st(t, e, n);
		},
		cmpStr(e, n, r) {
			return ct(t, e, n, r);
		},
		consume(e) {
			let t = this.tokenStart;
			return this.eat(e), this.substrToCursor(t);
		},
		consumeFunctionName() {
			let e = t.substring(this.tokenStart, this.tokenEnd - 1);
			return this.eat(2), e;
		},
		consumeNumber(e) {
			let n = t.substring(this.tokenStart, pt(t, this.tokenStart));
			return this.eat(e), n;
		},
		eat(e) {
			if (this.tokenType !== e) {
				let t = gt[e].slice(0, -6).replace(/-/g, " ").replace(/^./, (e) => e.toUpperCase()), n = `${/[[\](){}]/.test(t) ? `"${t}"` : t} is expected`, r = this.tokenStart;
				switch (e) {
					case 1:
						this.tokenType === 2 || this.tokenType === 7 ? (r = this.tokenEnd - 1, n = "Identifier is expected but function found") : n = "Identifier is expected";
						break;
					case 4:
						this.isDelim(Rc) && (this.next(), r++, n = "Name is expected");
						break;
					case 11: this.tokenType === 10 && (r = this.tokenEnd, n = "Percent sign is expected");
				}
				this.error(n, r);
			}
			this.next();
		},
		eatIdent(e) {
			(this.tokenType !== 1 || this.lookupValue(0, e) === !1) && this.error(`Identifier "${e}" is expected`), this.next();
		},
		eatDelim(e) {
			this.isDelim(e) || this.error(`Delim "${String.fromCharCode(e)}" is expected`), this.next();
		},
		getLocation(e, t) {
			return r ? o.getLocationRange(e, t, n) : null;
		},
		getLocationFromList(e) {
			if (r) {
				let t = this.getFirstListNode(e), r = this.getLastListNode(e);
				return o.getLocationRange(t === null ? this.tokenStart : t.loc.start.offset - o.startOffset, r === null ? this.tokenStart : r.loc.end.offset - o.startOffset, n);
			}
			return null;
		},
		error(e, n) {
			let r = n !== void 0 && n < t.length ? o.getLocation(n) : this.eof ? o.getLocation(lt(t, t.length - 1)) : o.getLocation(this.tokenStart);
			throw new Pc(e || "Unexpected input", t, r.offset, r.line, r.column, o.startLine, o.startColumn);
		}
	}), c = () => ({
		filename: n,
		source: t,
		tokenCount: s.tokenCount,
		getTokenType: (e) => s.getTokenType(e),
		getTokenTypeName: (e) => gt[s.getTokenType(e)],
		getTokenStart: (e) => s.getTokenStart(e),
		getTokenEnd: (e) => s.getTokenEnd(e),
		getTokenValue: (e) => s.source.substring(s.getTokenStart(e), s.getTokenEnd(e)),
		substring: (e, t) => s.source.substring(e, t),
		balance: s.balance.subarray(0, s.tokenCount + 1),
		isBlockOpenerTokenType: s.isBlockOpenerTokenType,
		isBlockCloserTokenType: s.isBlockCloserTokenType,
		getBlockTokenPairIndex: (e) => s.getBlockTokenPairIndex(e),
		getLocation: (e) => o.getLocation(e, n),
		getRangeLocation: (e, t) => o.getLocationRange(e, t, n)
	});
	return Object.assign(function(e, l) {
		t = e, l = l || {}, s.setSource(t, Ot), o.setSource(t, l.offset, l.line, l.column), n = l.filename || "<unknown>", r = !!l.positions, i = typeof l.onParseError == "function" ? l.onParseError : Ic, a = !1, s.parseAtrulePrelude = "parseAtrulePrelude" in l ? !!l.parseAtrulePrelude : !0, s.parseRulePrelude = "parseRulePrelude" in l ? !!l.parseRulePrelude : !0, s.parseValue = "parseValue" in l ? !!l.parseValue : !0, s.parseCustomProperty = "parseCustomProperty" in l && !!l.parseCustomProperty;
		let { context: u = "default", list: d = !0, onComment: f, onToken: p } = l;
		if (!(u in s.context)) throw Error("Unknown context `" + u + "`");
		Object.assign(s, d ? Uc : Hc), Array.isArray(p) ? s.forEachToken((e, t, n) => {
			p.push({
				type: e,
				start: t,
				end: n
			});
		}) : typeof p == "function" && s.forEachToken(p.bind(c())), typeof f == "function" && s.forEachToken((e, n, r) => {
			if (e === 25) {
				let e = s.getLocation(n, r), i = ct(t, r - 2, r, "*/") ? t.slice(n + 2, r - 2) : t.slice(n + 2, r);
				f(i, e);
			}
		});
		let m = s.context[u].call(s, l);
		return s.eof || s.error(), m;
	}, {
		SyntaxError: Pc,
		config: s.config
	});
}
//#endregion
//#region node_modules/css-tree/lib/syntax/scope/default.js
var Jc = 35, Yc = 42, Xc = 43, Zc = 45, Qc = 47, $c = 117;
function el(e) {
	switch (this.tokenType) {
		case 4: return this.Hash();
		case 18: return this.Operator();
		case 21: return this.Parentheses(this.readSequence, e.recognizer);
		case 19: return this.Brackets(this.readSequence, e.recognizer);
		case 5: return this.String();
		case 12: return this.Dimension();
		case 11: return this.Percentage();
		case 10: return this.Number();
		case 2: return this.cmpStr(this.tokenStart, this.tokenEnd, "url(") ? this.Url() : this.Function(this.readSequence, e.recognizer);
		case 7: return this.Url();
		case 1: return this.cmpChar(this.tokenStart, $c) && this.cmpChar(this.tokenStart + 1, Xc) ? this.UnicodeRange() : this.Identifier();
		case 9: {
			let e = this.charCodeAt(this.tokenStart);
			if (e === Qc || e === Yc || e === Xc || e === Zc) return this.Operator();
			e === Jc && this.error("Hex or identifier is expected", this.tokenStart + 1);
			break;
		}
	}
}
//#endregion
//#region node_modules/css-tree/lib/syntax/scope/atrulePrelude.js
var tl = { getNode: el }, nl = 35, rl = 38, il = 42, al = 43, ol = 47, sl = 46, cl = 62, ll = 124, ul = 126;
function dl(e, t) {
	t.last !== null && t.last.type !== "Combinator" && e !== null && e.type !== "Combinator" && t.push({
		type: "Combinator",
		loc: null,
		name: " "
	});
}
function fl() {
	switch (this.tokenType) {
		case 19: return this.AttributeSelector();
		case 4: return this.IdSelector();
		case 16: return this.lookupType(1) === 16 ? this.PseudoElementSelector() : this.PseudoClassSelector();
		case 1: return this.TypeSelector();
		case 10:
		case 11: return this.Percentage();
		case 12:
			this.charCodeAt(this.tokenStart) === sl && this.error("Identifier is expected", this.tokenStart + 1);
			break;
		case 9: switch (this.charCodeAt(this.tokenStart)) {
			case al:
			case cl:
			case ul:
			case ol: return this.Combinator();
			case sl: return this.ClassSelector();
			case il:
			case ll: return this.TypeSelector();
			case nl: return this.IdSelector();
			case rl: return this.NestingSelector();
		}
	}
}
var pl = {
	onWhiteSpace: dl,
	getNode: fl
};
//#endregion
//#region node_modules/css-tree/lib/syntax/function/expression.js
function ml() {
	return this.createSingleNodeList(this.Raw(null, !1));
}
//#endregion
//#region node_modules/css-tree/lib/syntax/function/var.js
function hl() {
	let e = this.createList();
	if (this.skipSC(), e.push(this.Identifier()), this.skipSC(), this.tokenType === 18) {
		e.push(this.Operator());
		let t = this.tokenIndex, n = this.parseCustomProperty ? this.Value(null) : this.Raw(this.consumeUntilExclamationMarkOrSemicolon, !1);
		if (n.type === "Value" && n.children.isEmpty) {
			for (let e = t - this.tokenIndex; e <= 0; e++) if (this.lookupType(e) === 13) {
				n.children.appendData({
					type: "WhiteSpace",
					loc: null,
					value: " "
				});
				break;
			}
		}
		e.push(n);
	}
	return e;
}
//#endregion
//#region node_modules/css-tree/lib/syntax/scope/value.js
function gl(e) {
	return e !== null && e.type === "Operator" && (e.value[e.value.length - 1] === "-" || e.value[e.value.length - 1] === "+");
}
var _l = {
	getNode: el,
	onWhiteSpace(e, t) {
		gl(e) && (e.value = " " + e.value), gl(t.last) && (t.last.value += " ");
	},
	expression: ml,
	var: hl
}, vl = /* @__PURE__ */ t({
	AtrulePrelude: () => tl,
	Selector: () => pl,
	Value: () => _l
}), yl = /* @__PURE__ */ new Set([
	"none",
	"and",
	"not",
	"or"
]), bl = { parse: {
	prelude() {
		let e = this.createList();
		if (this.tokenType === 1) {
			let t = this.substring(this.tokenStart, this.tokenEnd);
			yl.has(t.toLowerCase()) || e.push(this.Identifier());
		}
		return e.push(this.Condition("container")), e;
	},
	block(e = !1) {
		return this.Block(e);
	}
} }, xl = { parse: {
	prelude: null,
	block() {
		return this.Block(!0);
	}
} };
//#endregion
//#region node_modules/css-tree/lib/syntax/atrule/import.js
function Sl(e, t) {
	return this.parseWithFallback(() => {
		try {
			return e.call(this);
		} finally {
			this.skipSC(), this.lookupNonWSType(0) !== 22 && this.error();
		}
	}, t || (() => this.Raw(null, !0)));
}
var Cl = {
	layer() {
		this.skipSC();
		let e = this.createList(), t = Sl.call(this, this.Layer);
		return (t.type !== "Raw" || t.value !== "") && e.push(t), e;
	},
	supports() {
		this.skipSC();
		let e = this.createList(), t = Sl.call(this, this.Declaration, () => Sl.call(this, () => this.Condition("supports")));
		return (t.type !== "Raw" || t.value !== "") && e.push(t), e;
	}
}, wl = {
	container: bl,
	"font-face": xl,
	import: { parse: {
		prelude() {
			let e = this.createList();
			switch (this.tokenType) {
				case 5:
					e.push(this.String());
					break;
				case 7:
				case 2:
					e.push(this.Url());
					break;
				default: this.error("String or url() is expected");
			}
			return this.skipSC(), this.tokenType === 1 && this.cmpStr(this.tokenStart, this.tokenEnd, "layer") ? e.push(this.Identifier()) : this.tokenType === 2 && this.cmpStr(this.tokenStart, this.tokenEnd, "layer(") && e.push(this.Function(null, Cl)), this.skipSC(), this.tokenType === 2 && this.cmpStr(this.tokenStart, this.tokenEnd, "supports(") && e.push(this.Function(null, Cl)), (this.lookupNonWSType(0) === 1 || this.lookupNonWSType(0) === 21) && e.push(this.MediaQueryList()), e;
		},
		block: null
	} },
	layer: { parse: {
		prelude() {
			return this.createSingleNodeList(this.LayerList());
		},
		block() {
			return this.Block(!1);
		}
	} },
	media: { parse: {
		prelude() {
			return this.createSingleNodeList(this.MediaQueryList());
		},
		block(e = !1) {
			return this.Block(e);
		}
	} },
	nest: { parse: {
		prelude() {
			return this.createSingleNodeList(this.SelectorList());
		},
		block() {
			return this.Block(!0);
		}
	} },
	page: { parse: {
		prelude() {
			return this.createSingleNodeList(this.SelectorList());
		},
		block() {
			return this.Block(!0);
		}
	} },
	scope: { parse: {
		prelude() {
			return this.createSingleNodeList(this.Scope());
		},
		block(e = !1) {
			return this.Block(e);
		}
	} },
	"starting-style": { parse: {
		prelude: null,
		block(e = !1) {
			return this.Block(e);
		}
	} },
	supports: { parse: {
		prelude() {
			return this.createSingleNodeList(this.Condition("supports"));
		},
		block(e = !1) {
			return this.Block(e);
		}
	} }
};
//#endregion
//#region node_modules/css-tree/lib/syntax/pseudo/lang.js
function Tl() {
	let e = this.createList();
	this.skipSC();
	loop: for (; !this.eof;) {
		switch (this.tokenType) {
			case 1:
				e.push(this.Identifier());
				break;
			case 5:
				e.push(this.String());
				break;
			case 18:
				e.push(this.Operator());
				break;
			case 22: break loop;
			default: this.error("Identifier, string or comma is expected");
		}
		this.skipSC();
	}
	return e;
}
//#endregion
//#region node_modules/css-tree/lib/syntax/pseudo/index.js
var U = { parse() {
	return this.createSingleNodeList(this.SelectorList());
} }, El = { parse() {
	return this.createSingleNodeList(this.Selector());
} }, Dl = { parse() {
	return this.createSingleNodeList(this.Identifier());
} }, Ol = { parse: Tl }, kl = { parse() {
	return this.createSingleNodeList(this.Nth());
} }, Al = qc({
	parseContext: {
		default: "StyleSheet",
		stylesheet: "StyleSheet",
		atrule: "Atrule",
		atrulePrelude(e) {
			return this.AtrulePrelude(e.atrule ? String(e.atrule) : null);
		},
		mediaQueryList: "MediaQueryList",
		mediaQuery: "MediaQuery",
		condition(e) {
			return this.Condition(e.kind);
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
		supports: { selector() {
			return this.Selector();
		} },
		container: { style() {
			return this.Declaration();
		} }
	},
	scope: vl,
	atrule: wl,
	pseudo: {
		dir: Dl,
		has: U,
		lang: Ol,
		matches: U,
		is: U,
		"-moz-any": U,
		"-webkit-any": U,
		where: U,
		not: U,
		"nth-child": kl,
		"nth-last-child": kl,
		"nth-last-of-type": kl,
		"nth-of-type": kl,
		slotted: El,
		host: El,
		"host-context": El
	},
	node: /* @__PURE__ */ t({
		AnPlusB: () => sn,
		Atrule: () => hn,
		AtrulePrelude: () => xn,
		AttributeSelector: () => Pn,
		Block: () => Gn,
		Brackets: () => Xn,
		CDC: () => er,
		CDO: () => ir,
		ClassSelector: () => ur,
		Combinator: () => yr,
		Comment: () => Er,
		Condition: () => Pr,
		Declaration: () => Xr,
		DeclarationList: () => ai,
		Dimension: () => ui,
		Feature: () => gi,
		FeatureFunction: () => Si,
		FeatureRange: () => Ni,
		Function: () => zi,
		GeneralEnclosed: () => Wi,
		Hash: () => Yi,
		IdSelector: () => aa,
		Identifier: () => ea,
		Layer: () => da,
		LayerList: () => ga,
		MediaQuery: () => xa,
		MediaQueryList: () => Ea,
		NestingSelector: () => Ma,
		Nth: () => Ia,
		Number: () => Va,
		Operator: () => Ka,
		Parentheses: () => Za,
		Percentage: () => no,
		PseudoClassSelector: () => co,
		PseudoElementSelector: () => ho,
		Ratio: () => So,
		Raw: () => Do,
		Rule: () => Fo,
		Scope: () => Bo,
		Selector: () => Go,
		SelectorList: () => Zo,
		String: () => ns,
		StyleSheet: () => us,
		SupportsDeclaration: () => hs,
		TypeSelector: () => Cs,
		UnicodeRange: () => Fs,
		Url: () => zs,
		Value: () => Ws,
		WhiteSpace: () => Xs
	})
}), jl = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict", W = (e = 21) => {
	let t = "", n = e | 0;
	for (; n-- > 0;) t += jl[Math.random() * 64 | 0];
	return t;
}, Ml = {
	All: "all",
	None: "none"
};
function G(e, t) {
	var n;
	return t = (n = cu[t]) == null ? t : n, (e instanceof HTMLElement ? getComputedStyle(e) : e.computedStyle).getPropertyValue(t).trim();
}
function K(e, t, n) {
	return G(e, t) === n;
}
function Nl(e, { selector: t, pseudoElementPart: n }) {
	var r;
	let i = getComputedStyle(e, n), a = document.createElement("div"), o = document.createElement("style");
	a.id = `fake-pseudo-element-${W()}`;
	for (let e of Array.from(i)) {
		let t = i.getPropertyValue(e);
		a.style.setProperty(e, t);
	}
	o.textContent += `#${a.id}${n} { content: ${i.content}; }`, o.textContent += `${t} { display: none !important; }`, (r = $l(e)) == null || r.append(o);
	let s = n === "::before" ? "afterbegin" : "beforeend";
	return e.insertAdjacentElement(s, a), {
		fakePseudoElement: a,
		sheet: o,
		computedStyle: i
	};
}
function Pl(e) {
	let t = e;
	for (; t;) {
		if (K(t, "overflow", "scroll")) return t;
		t = t.parentElement;
	}
	return t;
}
function Fl(e) {
	var t;
	let n = Pl(e);
	return n === document.documentElement && (n = null), (t = n) == null ? {
		scrollTop: 0,
		scrollLeft: 0
	} : t;
}
function Il(e, t) {
	let { elementPart: n, pseudoElementPart: r } = e, i = [];
	if (r && r !== "::before" && r !== "::after") return i;
	let a = Vl(t.roots, n);
	if (!r) return i.push(...a), i;
	for (let t of a) {
		let { fakePseudoElement: n, sheet: r, computedStyle: a } = Nl(t, e), o = n.getBoundingClientRect(), { scrollY: s, scrollX: c } = globalThis, l = Fl(t);
		i.push({
			fakePseudoElement: n,
			computedStyle: a,
			removeFakePseudoElement() {
				n.remove(), r.remove();
			},
			contextElement: t,
			getBoundingClientRect() {
				let { scrollY: e, scrollX: t } = globalThis, { scrollTop: n, scrollLeft: r } = l;
				return DOMRect.fromRect({
					y: o.y + (s - e) + (l.scrollTop - n),
					x: o.x + (c - t) + (l.scrollLeft - r),
					width: o.width,
					height: o.height
				});
			}
		});
	}
	return i;
}
function Ll(e, t) {
	let n = G(e, "anchor-name");
	return t ? n.split(",").map((e) => e.trim()).includes(t) : !n;
}
function Rl(e, t) {
	let n = G(e, "anchor-scope");
	return n === t || n === Ml.All;
}
var zl = function() {
	var e = l(function* (e) {
		var t, n;
		let r = yield (t = D.getOffsetParent) == null ? void 0 : t.call(D, e);
		if (!(yield (n = D.isElement) == null ? void 0 : n.call(D, r))) {
			var i;
			r = (yield (i = D.getDocumentElement) == null ? void 0 : i.call(D, e)) || window.document.documentElement;
		}
		return r;
	});
	return function(t) {
		return e.apply(this, arguments);
	};
}();
function Bl(e, t) {
	let n = t.trim();
	if (n === ":host") return !0;
	let r = /^:host\(\s*(.+?)\s*\)$/.exec(n);
	if (r) try {
		return e.matches(r[1]);
	} catch (e) {
		return !1;
	}
	return !1;
}
var Vl = (e, t) => e.flatMap((e) => {
	let n = [...e.querySelectorAll(t)];
	if (e instanceof ShadowRoot) {
		let r = e.host;
		Bl(r, t) && n.push(r);
	}
	return n;
}), Hl, Ul, Wl = W(), Gl = /* @__PURE__ */ new Set();
function Kl(e) {
	return !!(e && e.type === "Function" && e.name === "anchor");
}
function q(e, t = !1) {
	return Al(e, {
		parseAtrulePrelude: !1,
		parseCustomProperty: !0,
		onParseError: (e) => {
			t && Gl.add(e);
		}
	});
}
function J(e) {
	return Oc(e, { mode: "spec" });
}
function ql(e) {
	return e.type === "Declaration";
}
var Jl = (Hl = (Ul = globalThis.CSSStyleSheet) == null ? void 0 : Ul.prototype.replaceSync) == null ? (() => {}) : Hl, Yl = /* @__PURE__ */ new WeakMap();
function Xl(e) {
	let t = Yl.get(e);
	return t === void 0 ? Array.from(e.cssRules).map((e) => e.cssText).join("\n") : t;
}
var Zl = /* @__PURE__ */ new WeakSet();
function Ql(e, t, n) {
	if (!Zl.has(e)) {
		let r = (n == null ? [] : n).filter((t) => "adoptedStyleSheets" in t && t.adoptedStyleSheets.includes(e));
		if (r.length) {
			let n = new CSSStyleSheet({
				media: e.media,
				disabled: e.disabled
			});
			Jl.call(n, t), Zl.add(n);
			for (let t of r) t.adoptedStyleSheets = t.adoptedStyleSheets.map((t) => t === e ? n : t);
			return n;
		}
	}
	return Jl.call(e, t), e;
}
function $l(e) {
	if (e instanceof ShadowRoot) return e;
	if (e instanceof Document) return e.head;
	let t = e.getRootNode();
	return t instanceof ShadowRoot ? t : t instanceof Document ? t.head : null;
}
`${Wl}`;
var Y = [
	"top",
	"left",
	"right",
	"bottom"
], eu = [
	...Y,
	"justify-self",
	"align-self"
], X = new Map(eu.map((e) => [e, `--pa-value-${e}-${Wl}`])), tu = new Map(Y.map((e) => [e, `--pa-wrapper-${e}-${Wl}`])), nu = [...X.values(), ...tu.values()];
function ru(e) {
	return e.toArray().reduce((e, t) => t.type === "Operator" && t.value === "," ? (e.push([]), e) : (t.type === "Identifier" && e[e.length - 1].push(t), e), [[]]);
}
function iu(e) {
	return e ? e.children.map((e) => {
		var t, n;
		let r;
		((t = e.children.last) == null ? void 0 : t.type) === "PseudoElementSelector" && (e = Ue(e), r = J(e.children.last), e.children.pop());
		let i = J(e);
		return {
			selector: i + ((n = r) == null ? "" : n),
			elementPart: i,
			pseudoElementPart: r
		};
	}).toArray() : [];
}
function au() {
	Gl.size > 0 && (console.group(`The CSS anchor positioning polyfill was not applied due to ${Gl.size === 1 ? "a CSS parse error" : "CSS parse errors"}.`), Gl.forEach((e) => {
		console.warn(e.formattedMessage);
	}), console.groupEnd());
}
function ou() {
	Gl.clear();
}
var su = (e) => G(e, "position") === "fixed" ? "fixed" : "absolute", cu = [
	...sc,
	...ic,
	"anchor-scope",
	"anchor-name"
].reduce((e, t) => (e[t] = `--${t}-${Wl}`, e), {}), lu = "data-generated-by-polyfill", uu = !1;
function du(e = [document]) {
	if (typeof CSS > "u") return;
	let t = [...Object.values(cu), ...nu];
	if (typeof CSS.registerProperty == "function") {
		if (uu) return;
		for (let e of t) try {
			CSS.registerProperty({
				name: e,
				syntax: "*",
				inherits: !1
			});
		} catch (e) {}
		uu = !0;
	} else if (typeof document < "u") {
		let [n] = t, r = t.map((e) => `${e}: initial;`).join("\n  ");
		for (let t of e) {
			let e = $l(t);
			if (!e || [...e.querySelectorAll("style[data-generated-by-polyfill]")].some((e) => {
				var t;
				return (t = e.textContent) == null ? void 0 : t.includes(`${n}: initial`);
			})) continue;
			let i = document.createElement("style");
			i.setAttribute(lu, "true"), i.textContent = `*,\n::before,\n::after {\n  ${r}\n}`, e.append(i);
		}
	}
}
function fu(e, t) {
	return ql(e) && cu[e.property] && t ? (t.children.appendData(h(h({}, e), {}, { property: cu[e.property] })), { updated: !0 }) : { updated: !1 };
}
function pu(e, t) {
	if (!ql(e) || !t || ![
		"inset",
		"inset-block",
		"inset-inline"
	].includes(e.property)) return { updated: !1 };
	let n = (n, r) => {
		r && t.children.appendData(h(h({}, e), {}, {
			property: n,
			value: {
				type: "Value",
				children: new He().fromArray([r])
			}
		}));
	};
	if (e.property === "inset") {
		let t = e.value.children.toArray(), [r, i, a, o] = (() => {
			switch (t.length) {
				case 1: return [
					t[0],
					t[0],
					t[0],
					t[0]
				];
				case 2: return [
					t[0],
					t[1],
					t[0],
					t[1]
				];
				case 3: return [
					t[0],
					t[1],
					t[2],
					t[1]
				];
				case 4: return [
					t[0],
					t[1],
					t[2],
					t[3]
				];
				default: return [];
			}
		})();
		n("top", r), n("right", i), n("bottom", a), n("left", o);
	} else if (e.property === "inset-block") {
		let t = e.value.children.toArray(), [r, i] = (() => {
			switch (t.length) {
				case 1: return [t[0], t[0]];
				case 2: return [t[0], t[1]];
				default: return [];
			}
		})();
		n("inset-block-start", r), n("inset-block-end", i);
	} else if (e.property === "inset-inline") {
		let t = e.value.children.toArray(), [r, i] = (() => {
			switch (t.length) {
				case 1: return [t[0], t[0]];
				case 2: return [t[0], t[1]];
				default: return [];
			}
		})();
		n("inset-inline-start", r), n("inset-inline-end", i);
	}
	return { updated: !0 };
}
function mu(e, t) {
	du(t);
	for (let t of e) {
		let e = !1, n = q(t.css, !0);
		H(n, {
			visit: "Declaration",
			enter(t) {
				var n;
				let r = (n = this.rule) == null ? void 0 : n.block, { updated: i } = pu(t, r), { updated: a } = fu(t, r);
				(a || i) && (e = !0);
			}
		}), e && (t.css = J(n), t.changed = !0);
	}
	return e.some((e) => e.changed === !0);
}
//#endregion
//#region src/fetch.ts
var hu = "InvalidMimeType";
function gu(e) {
	return !!((e.type === "text/css" || e.rel === "stylesheet") && e.href);
}
function _u(e) {
	let t = new URL(e.href, document.baseURI);
	if (gu(e) && t.origin === location.origin) return t;
}
function vu(e) {
	return yu.apply(this, arguments);
}
function yu() {
	return yu = l(function* (e) {
		return (yield Promise.all(e.map(function() {
			var e = l(function* (e) {
				var t;
				if (!e.url) return e;
				if ((t = e.el) != null && t.disabled) return null;
				try {
					let t = yield fetch(e.url.toString()), n = t.headers.get("content-type");
					if (!(n != null && n.startsWith("text/css"))) {
						let t = /* @__PURE__ */ Error(`Error loading ${e.url}: expected content-type "text/css", got "${n}".`);
						throw t.name = hu, t;
					}
					let r = yield t.text();
					return h(h({}, e), {}, { css: r });
				} catch (e) {
					if (e instanceof Error && e.name === hu) return console.warn(e), null;
					throw e;
				}
			});
			return function(t) {
				return e.apply(this, arguments);
			};
		}()))).filter((e) => e !== null);
	}), yu.apply(this, arguments);
}
var bu;
function xu(e) {
	var t;
	if (!bu) {
		let e = ["anchor", ...Object.keys(cu)];
		bu = RegExp(`(?:^|;)\\s*(?:${e.join("|")})`, "i");
	}
	return bu.test((t = e.getAttribute("style")) == null ? "" : t);
}
function Su(e) {
	let t = (e == null ? Array.from(document.querySelectorAll("[style]")) : e).filter((e) => e instanceof HTMLElement && xu(e)), n = [];
	return t.forEach((e) => {
		var t;
		let r = "data-has-inline-styles", i = (t = e.getAttribute(r)) == null ? W(12) : t;
		e.setAttribute(r, i);
		let a = `[${r}="${i}"] { ${e.getAttribute("style")} }`;
		n.push({
			el: e,
			css: a
		});
	}), n;
}
function Cu(e) {
	let t = [], n = /* @__PURE__ */ new Set();
	for (let r of e) {
		let e = r.adoptedStyleSheets;
		if (e) for (let r of e) n.has(r) || (n.add(r), t.push({
			css: Xl(r),
			sheet: r
		}));
	}
	return t;
}
function wu(e) {
	return Tu.apply(this, arguments);
}
function Tu() {
	return Tu = l(function* (e) {
		var t, n;
		let r = (t = e.elements) == null ? Vl(e.roots, "link, style") : t, i = [];
		r.filter((e) => e instanceof HTMLElement).filter((e) => !e.hasAttribute(lu)).forEach((e) => {
			if (e.tagName.toLowerCase() === "link") {
				let t = _u(e);
				t && i.push({
					el: e,
					url: t
				});
			}
			e.tagName.toLowerCase() === "style" && i.push({
				el: e,
				css: e.innerHTML
			});
		});
		let a = Su(e.excludeInlineStyles ? (n = e.elements) == null ? [] : n : void 0), o = e.elements ? [] : Cu(e.roots);
		return yield vu([
			...i,
			...a,
			...o
		]);
	}), Tu.apply(this, arguments);
}
//#endregion
//#region node_modules/nanoid/index.browser.js
var Eu = (e = 21) => {
	let t = "", n = crypto.getRandomValues(new Uint8Array(e |= 0));
	for (; e--;) t += jl[n[e] & 63];
	return t;
}, Du = `--pa-cascade-property-${Wl}`, Ou = "data-anchor-position-wrapper", ku = "data-anchor-position-area", Au = "data-pa-wrapper-for-", ju = "data-pa-target-for-", Mu = "POLYFILL-POSITION-AREA";
function Nu(e) {
	for (let t of nc) {
		let n = G(e, t);
		if ([
			"%",
			"stretch",
			"fit-content",
			"-webkit-fill-available"
		].some((e) => n.includes(e))) return !0;
	}
	for (let t of ec) {
		let n = G(e, t);
		if (["%", "auto"].some((e) => n.includes(e))) return !0;
	}
	for (let t of ic) if (G(e, t).includes("%")) return !0;
	for (let t of ac) {
		let n = G(e, t);
		if (["stretch", "anchor-center"].some((e) => n.includes(e))) return !0;
	}
	return !1;
}
var Z = {
	Logical: "Logical",
	LogicalSelf: "LogicalSelf",
	Physical: "Physical",
	PhysicalSelf: "PhysicalSelf",
	Irrelevant: "Irrelevant"
}, Pu = /* @__PURE__ */ "left.center.right.span-left.span-right.x-start.x-end.span-x-start.span-x-end.self-x-start.self-x-end.span-self-x-start.span-self-x-end.span-all.top.bottom.span-top.span-bottom.y-start.y-end.span-y-start.span-y-end.self-y-start.self-y-end.span-self-y-start.span-self-y-end.block-start.block-end.span-block-start.span-block-end.inline-start.inline-end.span-inline-start.span-inline-end.self-block-start.self-block-end.span-self-block-start.span-self-block-end.self-inline-start.self-inline-end.span-self-inline-start.span-self-inline-end.start.end.span-start.span-end.self-start.self-end.span-self-start.span-self-end".split(".");
function Fu(e) {
	return Pu.includes(e);
}
var Iu = {
	left: [
		0,
		1,
		Z.Irrelevant
	],
	center: [
		1,
		2,
		Z.Irrelevant
	],
	right: [
		2,
		3,
		Z.Irrelevant
	],
	"span-left": [
		0,
		2,
		Z.Irrelevant
	],
	"span-right": [
		1,
		3,
		Z.Irrelevant
	],
	"x-start": [
		0,
		1,
		Z.Physical
	],
	"x-end": [
		2,
		3,
		Z.Physical
	],
	"span-x-start": [
		0,
		2,
		Z.Physical
	],
	"span-x-end": [
		1,
		3,
		Z.Physical
	],
	"self-x-start": [
		0,
		1,
		Z.PhysicalSelf
	],
	"self-x-end": [
		2,
		3,
		Z.PhysicalSelf
	],
	"span-self-x-start": [
		0,
		2,
		Z.PhysicalSelf
	],
	"span-self-x-end": [
		1,
		3,
		Z.PhysicalSelf
	],
	"span-all": [
		0,
		3,
		Z.Irrelevant
	],
	top: [
		0,
		1,
		Z.Irrelevant
	],
	bottom: [
		2,
		3,
		Z.Irrelevant
	],
	"span-top": [
		0,
		2,
		Z.Irrelevant
	],
	"span-bottom": [
		1,
		3,
		Z.Irrelevant
	],
	"y-start": [
		0,
		1,
		Z.Physical
	],
	"y-end": [
		2,
		3,
		Z.Physical
	],
	"span-y-start": [
		0,
		2,
		Z.Physical
	],
	"span-y-end": [
		1,
		3,
		Z.Physical
	],
	"self-y-start": [
		0,
		1,
		Z.PhysicalSelf
	],
	"self-y-end": [
		2,
		3,
		Z.PhysicalSelf
	],
	"span-self-y-start": [
		0,
		2,
		Z.PhysicalSelf
	],
	"span-self-y-end": [
		1,
		3,
		Z.PhysicalSelf
	],
	"block-start": [
		0,
		1,
		Z.Logical
	],
	"block-end": [
		2,
		3,
		Z.Logical
	],
	"span-block-start": [
		0,
		2,
		Z.Logical
	],
	"span-block-end": [
		1,
		3,
		Z.Logical
	],
	"inline-start": [
		0,
		1,
		Z.Logical
	],
	"inline-end": [
		2,
		3,
		Z.Logical
	],
	"span-inline-start": [
		0,
		2,
		Z.Logical
	],
	"span-inline-end": [
		1,
		3,
		Z.Logical
	],
	"self-block-start": [
		0,
		1,
		Z.LogicalSelf
	],
	"self-block-end": [
		2,
		3,
		Z.LogicalSelf
	],
	"span-self-block-start": [
		0,
		2,
		Z.LogicalSelf
	],
	"span-self-block-end": [
		1,
		3,
		Z.LogicalSelf
	],
	"self-inline-start": [
		0,
		1,
		Z.LogicalSelf
	],
	"self-inline-end": [
		2,
		3,
		Z.LogicalSelf
	],
	"span-self-inline-start": [
		0,
		2,
		Z.LogicalSelf
	],
	"span-self-inline-end": [
		1,
		3,
		Z.LogicalSelf
	],
	start: [
		0,
		1,
		Z.Logical
	],
	end: [
		2,
		3,
		Z.Logical
	],
	"span-start": [
		0,
		2,
		Z.Logical
	],
	"span-end": [
		1,
		3,
		Z.Logical
	],
	"self-start": [
		0,
		1,
		Z.LogicalSelf
	],
	"self-end": [
		2,
		3,
		Z.LogicalSelf
	],
	"span-self-start": [
		0,
		2,
		Z.LogicalSelf
	],
	"span-self-end": [
		1,
		3,
		Z.LogicalSelf
	]
}, Lu = [
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
], Ru = [
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
], zu = [
	"block-start",
	"center",
	"block-end",
	"span-block-start",
	"span-block-end",
	"span-all"
], Bu = [
	"inline-start",
	"center",
	"inline-end",
	"span-inline-start",
	"span-inline-end",
	"span-all"
], Vu = [
	"self-block-start",
	"center",
	"self-block-end",
	"span-self-block-start",
	"span-self-block-end",
	"span-all"
], Hu = [
	"self-inline-start",
	"center",
	"self-inline-end",
	"span-self-inline-start",
	"span-self-inline-end",
	"span-all"
], Uu = [
	"start",
	"center",
	"end",
	"span-start",
	"span-end",
	"span-all"
], Wu = [
	"self-start",
	"center",
	"self-end",
	"span-self-start",
	"span-self-end",
	"span-all"
], Gu = [
	"block",
	"top",
	"bottom",
	"y"
], Ku = [
	"inline",
	"left",
	"right",
	"x"
];
function qu(e) {
	let t = e.split("-");
	for (let e of t) {
		if (Gu.includes(e)) return "block";
		if (Ku.includes(e)) return "inline";
	}
	return "ambiguous";
}
function Ju(e, t) {
	return t[0].includes(e[0]) && t[1].includes(e[1]) || t[0].includes(e[1]) && t[1].includes(e[0]);
}
var Yu = [
	[Lu, Ru],
	[zu, Bu],
	[Vu, Hu],
	[Uu, Uu],
	[Wu, Wu]
];
function Xu(e) {
	for (let t of Yu) if (Ju(e, t)) return !0;
	return !1;
}
var Zu = (e) => {
	let t = getComputedStyle(e);
	return {
		writingMode: t.writingMode,
		direction: t.direction
	};
}, Qu = function() {
	var e = l(function* (e, t) {
		let n = yield zl(e);
		switch (t) {
			case Z.Logical:
			case Z.Physical: return Zu(n);
			case Z.LogicalSelf:
			case Z.PhysicalSelf: return Zu(e);
			default: return null;
		}
	});
	return function(t, n) {
		return e.apply(this, arguments);
	};
}(), $u = (e) => e.reverse().map((e) => 3 - e), ed = (e, t) => e === Z.Irrelevant ? t : e, td = function() {
	var e = l(function* ({ block: e, inline: t }, n) {
		let r = yield Qu(n, ed(e[2], t[2])), i = {
			block: [e[0], e[1]],
			inline: [t[0], t[1]]
		};
		if (r) {
			if (r.direction === "rtl" && (i.inline = $u(i.inline)), r.writingMode.startsWith("vertical")) {
				let e = i.block;
				i.block = i.inline, i.inline = e;
			}
			if (r.writingMode.startsWith("sideways")) {
				let e = i.block;
				i.block = i.inline, i.inline = e, r.writingMode.endsWith("lr") && (i.block = $u(i.block));
			}
			r.writingMode.endsWith("rl") && (i.inline = $u(i.inline));
		}
		return i;
	});
	return function(t, n) {
		return e.apply(this, arguments);
	};
}(), nd = ({ block: e, inline: t }) => {
	let n = [
		0,
		"top",
		"bottom",
		0
	], r = [
		0,
		"left",
		"right",
		0
	];
	return {
		block: [n[e[0]], n[e[1]]],
		inline: [r[t[0]], r[t[1]]]
	};
};
function rd([e, t]) {
	return e === 0 && t === 3 ? "center" : e === 0 ? "end" : t === 3 ? "start" : "center";
}
function id(e) {
	return e.type === "Declaration" && e.property === "position-area";
}
function ad(e) {
	let t = e.value.children.toArray().map(({ name: e }) => e);
	return t.length === 1 && (qu(t[0]) === "ambiguous" ? t.push(t[0]) : t.push("span-all")), t;
}
function od(e) {
	if (!id(e)) return;
	let t = ad(e);
	if (!Xu(t)) return;
	let n = {};
	switch (qu(t[0])) {
		case "block":
			n.block = t[0], n.inline = t[1];
			break;
		case "inline":
			n.inline = t[0], n.block = t[1];
			break;
		case "ambiguous": qu(t[1]) == "block" ? (n.block = t[1], n.inline = t[0]) : (n.inline = t[1], n.block = t[0]);
	}
	return {
		values: n,
		grid: {
			block: Iu[n.block],
			inline: Iu[n.inline]
		},
		selectorUUID: `--pa-declaration-${Eu(12)}`
	};
}
function sd(e, t, n = !0) {
	let r = (e, n) => {
		t.children.appendData({
			type: "Declaration",
			property: e,
			value: {
				type: "Raw",
				value: n
			},
			important: !1
		});
	};
	n === "auto" ? (r("justify-self", `var(${X.get("justify-self")}, normal)`), r("align-self", `var(${X.get("align-self")}, normal)`), Y.forEach((e) => r(e, `var(${X.get(e)}, auto)`))) : (n ? ["justify-self", "align-self"] : [...Y]).forEach((e) => r(e, `var(${X.get(e)})`)), r(Du, e.selectorUUID);
}
function cd(e, t) {
	var n;
	let r;
	if (((n = e.parentElement) == null ? void 0 : n.tagName) === Mu) r = e.parentElement;
	else {
		r = document.createElement(Mu), r.style.display = "grid", r.style.position = su(e);
		let t = getComputedStyle(e).pointerEvents;
		if (r.style.pointerEvents = "none", e.style.pointerEvents = t, e.hasAttribute("popover")) {
			let t = getComputedStyle(e);
			[
				"top",
				"right",
				"bottom",
				"left"
			].forEach((e) => {
				let n = t[e];
				n && n !== "auto" && parseFloat(n) !== 0 && r.style.setProperty(`padding-${e}`, n);
			}), e.style.inset = "auto";
		}
		Y.forEach((e) => {
			r.style.setProperty(e, `var(${tu.get(e)})`);
		}), e.insertAdjacentElement("beforebegin", r), r.appendChild(e);
	}
	return r.setAttribute(`${Au}${t}`, ""), r;
}
function ld(e, t) {
	e.setAttribute(`${ju}${t}`, "");
}
function ud(e, t, n) {
	return dd.apply(this, arguments);
}
function dd() {
	return dd = l(function* (e, t, n, r = !0) {
		let i = `--pa-target-${Eu(12)}`, a = yield td(t.grid, e), o = nd(a), s;
		if (r) {
			let e = ed(t.grid.block[2], t.grid.inline[2]);
			s = [Z.LogicalSelf, Z.PhysicalSelf].includes(e) ? a : t.grid;
		} else s = a;
		let c = {
			block: rd([s.block[0], s.block[1]]),
			inline: rd([s.inline[0], s.inline[1]])
		}, l;
		return r ? l = cd(e, i) : ld(e, i), {
			insets: o,
			alignments: c,
			targetUUID: i,
			targetEl: e,
			anchorEl: n,
			wrapperEl: l,
			values: t.values,
			grid: t.grid,
			selectorUUID: t.selectorUUID
		};
	}), dd.apply(this, arguments);
}
function fd(e, t) {
	return `
    [${Ou}="${t}"][${Au}${e}] {
      ${Y.map((t) => `${tu.get(t)}: var(${e}-${t});`).join("\n      ")}
    }
    [${Ou}="${t}"][${Au}${e}] > * {
      ${X.get("justify-self")}: var(${e}-justify-self);
      ${X.get("align-self")}: var(${e}-align-self);
    }
  `.replaceAll("\n", "");
}
function pd(e, t) {
	return `
    [${ku}="${t}"][${ju}${e}] {
      ${Y.map((t) => `${X.get(t)}: var(${e}-${t});`).join("\n      ")}
    }
  `.replaceAll("\n", "");
}
//#endregion
//#region src/fallback.ts
var md = [
	"normal",
	"most-width",
	"most-height",
	"most-block-size",
	"most-inline-size"
], hd = [
	"flip-block",
	"flip-inline",
	"flip-start"
];
function gd(e) {
	return e.type === "Declaration";
}
function _d(e) {
	return e.type === "Declaration" && e.property === "position-try-fallbacks";
}
function vd(e) {
	return e.type === "Declaration" && e.property === "position-try-order";
}
function yd(e) {
	return e.type === "Declaration" && e.property === "position-try";
}
function bd(e) {
	return e.type === "Atrule" && e.name === "position-try";
}
function xd(e) {
	return hd.includes(e);
}
function Sd(e) {
	return md.includes(e);
}
function Cd(e, t) {
	let n = document.querySelector(e);
	if (n) {
		let e = Td(n);
		return t.forEach((t) => {
			e = Pd(e, t);
		}), e;
	}
}
function wd(e, t) {
	let n = e.declarations;
	return t.forEach((e) => {
		n = Pd(n, e);
	}), n;
}
function Td(e) {
	let t = {};
	return sc.forEach((n) => {
		let r = G(e, `--${n}-${Wl}`);
		r && (t[n] = r);
	}), t;
}
var Ed = {
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
}, Dd = {
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
}, Od = {
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
	"flip-start": {}
};
function kd(e, t) {
	return Ed[t][e] || e;
}
function Ad(e, t) {
	return Dd[t][e] || e;
}
function jd(e, t) {
	if (t === "flip-start") return e;
	{
		let n = Od[t];
		return e.split("-").map((e) => n[e] || e).join("-");
	}
}
function Md(e, t, n) {
	if (e === "margin") {
		let [e, r, i, a] = t.children.toArray();
		n === "flip-block" ? a ? t.children.fromArray([
			i,
			r,
			e,
			a
		]) : i && t.children.fromArray([
			i,
			r,
			e
		]) : n === "flip-inline" && a && t.children.fromArray([
			e,
			a,
			i,
			r
		]);
	} else if (e === "margin-block") {
		let [e, r] = t.children.toArray();
		n === "flip-block" && r && t.children.fromArray([r, e]);
	} else if (e === "margin-inline") {
		let [e, r] = t.children.toArray();
		n === "flip-inline" && r && t.children.fromArray([r, e]);
	}
}
var Nd = (e, t) => {
	var n;
	return ((n = q(`#id{${e}: ${t};}`).children.first) == null ? void 0 : n.block.children.first).value;
};
function Pd(e, t) {
	let n = {};
	return Object.entries(e).forEach(([e, r]) => {
		let i = e, a = Nd(i, r), o = kd(i, t);
		o !== i && (n[i] != null || (n[i] = "revert")), H(a, {
			visit: "Function",
			enter(e) {
				Kl(e) && e.children.forEach((e) => {
					cf(e) && dc(e.name) && (e.name = Ad(e.name, t));
				});
			}
		}), i === "position-area" && a.children.forEach((e) => {
			cf(e) && Fu(e.name) && (e.name = jd(e.name, t));
		}), i.startsWith("margin") && Md(i, a, t), n[o] = J(a);
	}), n;
}
function Fd(e) {
	let t = ru(e), n = [];
	return t.forEach((e) => {
		let t = {
			atRules: [],
			tactics: [],
			positionAreas: []
		};
		e.forEach((e) => {
			xd(e.name) ? t.tactics.push(e.name) : e.name.startsWith("--") ? t.atRules.push(e.name) : Fu(e.name) && t.positionAreas.push(e.name);
		}), t.positionAreas.length ? n.push({
			positionArea: t.positionAreas[0],
			type: "position-area"
		}) : t.atRules.length && t.tactics.length ? n.push({
			tactics: t.tactics,
			atRule: t.atRules[0],
			type: "at-rule-with-try-tactic"
		}) : t.atRules.length ? n.push({
			atRule: t.atRules[0],
			type: "at-rule"
		}) : t.tactics.length && n.push({
			tactics: t.tactics,
			type: "try-tactic"
		});
	}), n;
}
function Id(e) {
	return _d(e) && e.value.children.first ? Fd(e.value.children) : [];
}
function Ld(e) {
	if (yd(e) && e.value.children.first) {
		let t = Ue(e), n, r = t.value.children.first.name;
		r && Sd(r) && (n = r, t.value.children.shift());
		let i = Fd(t.value.children);
		return {
			order: n,
			options: i
		};
	}
	return {};
}
function Rd(e) {
	return vd(e) && e.value.children.first ? { order: e.value.children.first.name } : {};
}
function zd(e) {
	let { order: t, options: n } = Ld(e);
	if (t || n) return {
		order: t,
		options: n
	};
	let { order: r } = Rd(e), i = Id(e);
	return r || i ? {
		order: r,
		options: i
	} : {};
}
function Bd(e) {
	return $s(e.property) || tc(e.property) || rc(e.property) || oc(e.property) || ["position-anchor", "position-area"].includes(e.property);
}
function Vd(e) {
	var t, n;
	if (bd(e) && (t = e.prelude) != null && t.value && (n = e.block) != null && n.children) {
		let t = e.prelude.value, n = e.block.children.filter((e) => gd(e) && Bd(e));
		return {
			name: t,
			tryBlock: {
				uuid: `${t}-try-${W(12)}`,
				declarations: Object.fromEntries(n.map((e) => [e.property, J(e.value)]))
			}
		};
	}
	return {};
}
function Hd(e) {
	let t = {}, n = {}, r = {};
	for (let n of e) H(q(n.css), {
		visit: "Atrule",
		enter(e) {
			let { name: n, tryBlock: r } = Vd(e);
			n && r && (t[n] = r);
		}
	});
	for (let i of e) {
		let e = !1, a = /* @__PURE__ */ new Set(), o = q(i.css);
		H(o, {
			visit: "Declaration",
			enter(i) {
				var o;
				let s = iu((o = this.rule) == null ? void 0 : o.prelude);
				if (!s.length) return;
				let { order: c, options: l } = zd(i);
				s.forEach(({ selector: i }) => {
					let o = {};
					c && (o.order = c);
					let s = /* @__PURE__ */ new Set();
					if (l == null || l.forEach((r) => {
						let c;
						if (r.type === "at-rule") c = r.atRule;
						else if (r.type === "try-tactic") {
							c = `${i}-${r.tactics.join("-")}`;
							let e = Cd(i, r.tactics);
							e && (t[c] = {
								uuid: `${i}-${r.tactics.join("-")}-try-${W(12)}`,
								declarations: e
							});
						} else if (r.type === "at-rule-with-try-tactic") {
							c = `${i}-${r.atRule}-${r.tactics.join("-")}`;
							let e = t[r.atRule], n = wd(e, r.tactics);
							n && (t[c] = {
								uuid: `${i}-${r.atRule}-${r.tactics.join("-")}-try-${W(12)}`,
								declarations: n
							});
						}
						if (c && t[c]) {
							let r = `[data-anchor-polyfill="${t[c].uuid}"]`;
							if (n[r] != null || (n[r] = []), n[r].push(i), !s.has(c) && (s.add(c), o.fallbacks != null || (o.fallbacks = []), o.fallbacks.push(t[c])), !a.has(c)) {
								var l;
								a.add(c), (l = this.stylesheet) == null || l.children.prependData({
									type: "Rule",
									prelude: {
										type: "Raw",
										value: r
									},
									block: {
										type: "Block",
										children: new He().fromArray(Object.entries(t[c].declarations).map(([e, t]) => ({
											type: "Declaration",
											important: !0,
											property: e,
											value: {
												type: "Raw",
												value: t
											}
										})))
									}
								}), e = !0;
							}
						}
					}), Object.keys(o).length > 0) {
						if (r[i]) {
							if (o.order && (r[i].order = o.order), o.fallbacks) {
								var u;
								(u = r[i]).fallbacks != null || (u.fallbacks = []), r[i].fallbacks.push(...o.fallbacks);
							}
						} else r[i] = o;
					}
				});
			}
		}), e && (i.css = J(o), i.changed = !0);
	}
	return {
		fallbackTargets: n,
		validPositions: r
	};
}
//#endregion
//#region src/validate.ts
function Ud(e, t) {
	return !e || e === t ? !1 : Wd(e) ? e.document.contains(t) : e.contains(t);
}
function Wd(e) {
	return !!(e && e === e.window);
}
function Gd(e) {
	return K(e, "position", "fixed");
}
function Kd(e) {
	return !!(e && (Gd(e) || K(e, "position", "absolute")));
}
function qd(e, t) {
	return e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING;
}
function Jd(e) {
	return Yd.apply(this, arguments);
}
function Yd() {
	return Yd = l(function* (e) {
		return yield D.getOffsetParent(e);
	}), Yd.apply(this, arguments);
}
function Xd(e) {
	return Zd.apply(this, arguments);
}
function Zd() {
	return Zd = l(function* (e) {
		if (!["absolute", "fixed"].includes(G(e, "position"))) return yield Jd(e);
		let t = e.parentElement;
		for (; t;) {
			if (!K(t, "position", "static") && K(t, "display", "block")) return t;
			t = t.parentElement;
		}
		return window;
	}), Zd.apply(this, arguments);
}
function Qd(e, t, n, r) {
	return $d.apply(this, arguments);
}
function $d() {
	return $d = l(function* (e, t, n, r) {
		let i = yield Xd(e), a = yield Xd(n);
		if (!(Ud(a, e) || Wd(a)) || i === a && !(!Kd(e) || qd(e, n))) return !1;
		if (i !== a) {
			let e, t = [];
			for (e = i; e && e !== a && e !== window;) t.push(e), e = yield Xd(e);
			let r = t[t.length - 1];
			if (r instanceof HTMLElement && !(!Kd(r) || qd(r, n))) return !1;
		}
		{
			let t = e.parentElement;
			for (; t;) {
				if (K(t, "content-visibility", "hidden")) return !1;
				t = t.parentElement;
			}
		}
		return !(t && r && ef(e, t, r) !== ef(n, t, r));
	}), $d.apply(this, arguments);
}
function ef(e, t, n) {
	for (; !(e.matches(n) && Rl(e, t));) {
		if (!e.parentElement) return null;
		e = e.parentElement;
	}
	return e;
}
function tf(e, t, n, r, i) {
	return nf.apply(this, arguments);
}
function nf() {
	return nf = l(function* (e, t, n, r, i) {
		if (!(e instanceof HTMLElement && n.length && Kd(e))) return null;
		let a = n.flatMap((e) => Il(e, i)).filter((e) => Ll(e, t)), o = r.map((e) => e.selector).join(",") || null;
		for (let n = a.length - 1; n >= 0; n--) {
			let r = a[n], i = "fakePseudoElement" in r;
			if (yield Qd(i ? r.fakePseudoElement : r, t, e, o)) return i && r.removeFakePseudoElement(), r;
		}
		return null;
	}), nf.apply(this, arguments);
}
//#endregion
//#region src/parse.ts
function rf(e) {
	return e.type === "Declaration" && e.property === "anchor-name";
}
function af(e) {
	return e.type === "Declaration" && e.property === "anchor-scope";
}
function of(e) {
	return !!(e && e.type === "Function" && e.name === "anchor-size");
}
function sf(e) {
	return !!(e && e.type === "Function" && e.name === "var");
}
function cf(e) {
	return !!(e.type === "Identifier" && e.name);
}
function lf(e) {
	return !!(e.type === "Percentage" && e.value);
}
function uf(e, t) {
	let n, r, i, a = "", o = !1, s, c = [];
	e.children.toArray().forEach((e) => {
		if (o) {
			a = `${a}${J(e)}`;
			return;
		}
		if (e.type === "Operator" && e.value === ",") {
			o = !0;
			return;
		}
		c.push(e);
	});
	let [l, u] = c;
	if (u || (u = l, l = void 0), l && (cf(l) && l.name.startsWith("--") ? n = l.name : sf(l) && l.children.first && (s = l.children.first.name)), u) {
		if (Kl(e)) {
			if (cf(u) && dc(u.name)) r = u.name;
			else if (lf(u)) {
				let e = Number(u.value);
				r = Number.isNaN(e) ? void 0 : e;
			}
		} else of(e) && cf(u) && pc(u.name) && (i = u.name);
	}
	let d = `--anchor-${W(12)}`;
	return t && (Object.assign(e, {
		type: "Raw",
		value: `var(${d})`,
		children: null
	}), Reflect.deleteProperty(e, "name")), {
		anchorName: n,
		anchorSide: r,
		anchorSize: i,
		fallbackValue: a,
		customPropName: s,
		uuid: d
	};
}
function df(e) {
	return e.value.children.map(({ name: e }) => e);
}
var ff = {}, pf = {}, Q = {}, mf = {}, $ = {};
function hf() {
	ff = {}, pf = {}, Q = {}, mf = {}, $ = {};
}
function gf(e, t) {
	if ((Kl(e) || of(e)) && t) {
		if (t.property.startsWith("--")) {
			var n;
			let r = J(t.value), i = uf(e, !0);
			return mf[i.uuid] = r, Q[t.property] = [...(n = Q[t.property]) == null ? [] : n, i], { changed: !0 };
		}
		if (Kl(e) && $s(t.property) || of(e) && lc(t.property)) {
			let n = uf(e, !0);
			return {
				prop: t.property,
				data: n,
				changed: !0
			};
		}
	}
	return {};
}
function _f(e) {
	let t = e.getAttribute("style");
	return t ? /(?:^|;)\s*position-anchor\s*:/i.test(t) : !1;
}
function vf(e, t, n, r, i) {
	return yf.apply(this, arguments);
}
function yf() {
	return yf = l(function* (e, t, n, r, i) {
		let a = t == null ? void 0 : t.anchorName, o = t == null ? void 0 : t.customPropName, s = !1;
		if (e && !a) {
			let t = G(e, "position-anchor");
			t ? (a = t, s = _f(e)) : o && (a = G(e, o));
		}
		let c = a && r[a] || [], l = a && i[Ml.All] || [], u = a && i[a] || [], d = n.roots, f = e == null ? void 0 : e.getRootNode();
		return s && (f instanceof Document || f instanceof ShadowRoot) && !d.includes(f) && (d = [...d, f]), yield tf(e, a || null, c, [...l, ...u], { roots: d });
	}), yf.apply(this, arguments);
}
function bf(e, t) {
	return xf.apply(this, arguments);
}
function xf() {
	return xf = l(function* (e, t) {
		let n = {}, r = {}, i = t.positionAreaContainingBlock;
		hf();
		let { fallbackTargets: a, validPositions: o } = Hd(e);
		for (let t of e) {
			let e = !1, a = q(t.css);
			H(a, function(t) {
				var a;
				let o = iu((a = this.rule) == null ? void 0 : a.prelude);
				if (rf(t) && o.length) for (let e of df(t)) {
					var s;
					(s = ff)[e] != null || (s[e] = []), ff[e].push(...o);
				}
				if (af(t) && o.length) for (let e of df(t)) {
					var c;
					(c = pf)[e] != null || (c[e] = []), pf[e].push(...o);
				}
				let { prop: l, data: u, changed: d } = gf(t, this.declaration);
				if (l && u && o.length) for (let { selector: e } of o) {
					var f, p;
					n[e] = h(h({}, n[e]), {}, { [l]: [...(f = (p = n[e]) == null ? void 0 : p[l]) == null ? [] : f, u] });
				}
				let m;
				if (this.block && (m = od(t), m)) {
					sd(m, this.block, i);
					for (let { selector: e } of o) {
						var g;
						r[e] = [...(g = r[e]) == null ? [] : g, m];
					}
				}
				(d || m) && (e = !0);
			}), e && (t.css = J(a), t.changed = !0);
		}
		let s = new Set(Object.keys(Q)), c = {}, l = (e) => {
			var t, n;
			let r = [], i = new Set((t = (n = c[e]) == null ? void 0 : n.names) == null ? [] : t);
			for (; i.size > 0;) for (let e of i) {
				var a, o;
				r.push(...(a = Q[e]) == null ? [] : a), i.delete(e), (o = c[e]) != null && (o = o.names) != null && o.length && c[e].names.forEach((e) => i.add(e));
			}
			return r;
		};
		for (; s.size > 0;) {
			let t = [];
			for (let n of e) {
				let e = !1, r = q(n.css);
				H(r, {
					visit: "Function",
					enter(n) {
						var r;
						let i = (r = this.rule) == null ? void 0 : r.prelude, a = this.declaration, o = a == null ? void 0 : a.property;
						if ((i == null ? void 0 : i.children.isEmpty) === !1 && sf(n) && a && o && n.children.first && s.has(n.children.first.name) && o.startsWith("--")) {
							var u;
							let r = n.children.first, i = (u = Q[r.name]) == null ? [] : u, s = l(r.name);
							if (!(i.length || s.length)) return;
							let d = `${r.name}-anchor-${W(12)}`, f = J(a.value);
							mf[d] = f, c[o] || (c[o] = {
								names: [],
								uuids: []
							});
							let p = c[o];
							p.names.includes(r.name) || p.names.push(r.name), p.uuids.push(d), t.push(o), r.name = d, e = !0;
						}
					}
				}), e && (n.css = J(r), n.changed = !0);
			}
			s.clear(), t.forEach((e) => s.add(e));
		}
		for (let t of e) {
			let e = !1, r = q(t.css);
			H(r, {
				visit: "Function",
				enter(t) {
					var r;
					let i = (r = this.rule) == null ? void 0 : r.prelude, a = this.declaration, o = a == null ? void 0 : a.property;
					if ((i == null ? void 0 : i.children.isEmpty) === !1 && sf(t) && a && o && t.children.first && ($s(o) || rc(o))) {
						var s;
						let r = t.children.first, a = (s = Q[r.name]) == null ? [] : s, g = l(r.name);
						if (!(a.length || g.length)) return;
						let _ = `${o}-${W(12)}`;
						if (g.length) {
							let e = /* @__PURE__ */ new Set([r.name]);
							for (; e.size > 0;) for (let t of e) {
								var u, d, f;
								let n = c[t];
								if (n != null && (u = n.names) != null && u.length && n != null && (d = n.uuids) != null && d.length) for (let e of n.names) for (let t of n.uuids) $[t] = h(h({}, $[t]), {}, { [_]: `${e}-${_}` });
								e.delete(t), n != null && (f = n.names) != null && f.length && n.names.forEach((t) => e.add(t));
							}
						}
						let v = iu(i);
						for (let e of [...a, ...g]) {
							let t = h({}, e), r = `--anchor-${W(12)}-${o}`, i = t.uuid;
							t.uuid = r;
							for (let { selector: e } of v) {
								var p, m;
								n[e] = h(h({}, n[e]), {}, { [o]: [...(p = (m = n[e]) == null ? void 0 : m[o]) == null ? [] : p, t] });
							}
							$[i] = h(h({}, $[i]), {}, { [_]: r });
						}
						r.name = `${r.name}-${_}`, e = !0;
					}
				}
			}), e && (t.css = J(r), t.changed = !0);
		}
		if (Object.keys($).length > 0) for (let t of e) {
			let e = !1, n = q(t.css);
			H(n, {
				visit: "Function",
				enter(t) {
					var n, r;
					if (sf(t) && (n = t.children.first) != null && (n = n.name) != null && n.startsWith("--") && (r = this.declaration) != null && (r = r.property) != null && r.startsWith("--") && this.block) {
						let n = t.children.first, r = $[n.name];
						if (r) for (let [t, i] of Object.entries(r)) this.block.children.appendData({
							type: "Declaration",
							important: !1,
							property: `${this.declaration.property}-${t}`,
							value: {
								type: "Raw",
								value: J(this.declaration.value).replace(`var(${n.name})`, `var(${i})`)
							}
						}), e = !0;
						mf[n.name] && (this.declaration.value = {
							type: "Raw",
							value: mf[n.name]
						}, e = !0);
					}
				}
			}), e && (t.css = J(n), t.changed = !0);
		}
		let u = ff, d = pf, f = /* @__PURE__ */ new Map();
		for (let [e, r] of Object.entries(n)) {
			var p;
			let n;
			n = e.startsWith("[data-anchor-polyfill=") && (p = a[e]) != null && p.length ? Vl(t.roots, a[e].join(",")) : Vl(t.roots, e);
			for (let [i, a] of Object.entries(r)) for (let r of a) for (let a of n) {
				var m, g, _, v, y;
				let n = yield vf(a, r, { roots: t.roots }, u, d), s = `--anchor-${W(12)}`;
				f.set(a, h(h({}, (m = f.get(a)) == null ? {} : m), {}, { [r.uuid]: s })), a.setAttribute("style", `${r.uuid}: var(${s}); ${(g = a.getAttribute("style")) == null ? "" : g}`), o[e] = h(h({}, o[e]), {}, { declarations: h(h({}, (_ = o[e]) == null ? void 0 : _.declarations), {}, { [i]: [...(v = (y = o[e]) == null || (y = y.declarations) == null ? void 0 : y[i]) == null ? [] : v, h(h({}, r), {}, {
					anchorEl: n,
					targetEl: a,
					uuid: s
				})] }) });
			}
		}
		let ee = /* @__PURE__ */ new Map(), b = Object.entries(r).map(([e, n]) => ({
			targetSel: e,
			positions: n,
			targets: Vl(t.roots, e)
		}));
		for (let { targetSel: e, positions: n, targets: r } of b) for (let a of r) {
			let r = yield vf(a, null, { roots: t.roots }, u, d), s = i === "auto" ? Nu(a) : i;
			for (let t of n) {
				var x, te, S;
				let n = yield ud(a, t, r, s), i = s ? fd : pd, c = $l(a);
				if (c) {
					var ne;
					ee.set(c, ((ne = ee.get(c)) == null ? "" : ne) + i(n.targetUUID, t.selectorUUID));
				}
				o[e] = h(h({}, o[e]), {}, { declarations: h(h({}, (x = o[e]) == null ? void 0 : x.declarations), {}, { "position-area": [...(te = (S = o[e]) == null || (S = S.declarations) == null ? void 0 : S["position-area"]) == null ? [] : te, n] }) });
			}
		}
		return {
			rules: o,
			inlineStyles: f,
			anchorScopes: pf,
			positionAreaStyles: ee
		};
	}), xf.apply(this, arguments);
}
//#endregion
//#region src/transform.ts
var Sf = [
	"as",
	"blocking",
	"crossorigin",
	"disabled",
	"fetchpriority",
	"href",
	"hreflang",
	"integrity",
	"referrerpolicy",
	"rel",
	"type"
];
function Cf(e, t, n) {
	let r = [];
	for (let { el: a, css: o, changed: s, sheet: c } of e) {
		let e = {
			el: a,
			css: o,
			changed: !1,
			sheet: c
		};
		if (s) {
			if (c) e.sheet = Ql(c, o, n);
			else if ((a == null ? void 0 : a.tagName.toLowerCase()) === "style") a.innerHTML = o;
			else if (a instanceof HTMLLinkElement) {
				let t = document.createElement("style");
				t.textContent = o;
				for (let e of a.getAttributeNames()) if (!e.startsWith("on") && !Sf.includes(e)) {
					let n = a.getAttribute(e);
					n !== null && t.setAttribute(e, n);
				}
				a.hasAttribute("href") && t.setAttribute("data-original-href", a.getAttribute("href")), a.insertAdjacentElement("beforebegin", t), a.remove(), e.el = t;
			} else if (a != null && a.hasAttribute("data-has-inline-styles")) {
				let e = a.getAttribute("data-has-inline-styles");
				if (e) {
					var i;
					let n = `[data-has-inline-styles="${e}"]{`, r = o.slice(n.length, -1), s = t == null ? void 0 : t.get(a);
					if (s) for (let [e, t] of Object.entries(s)) r = `${e}: var(${t}); ${r}`;
					let c = ((i = a.getAttribute("style")) == null ? "" : i).split(";").map((e) => e.trim()).filter((e) => {
						let t = e.slice(0, e.indexOf(":")).trim();
						return t.startsWith("--anchor-") && !r.includes(`${t}:`);
					});
					c.length && (r = `${c.join("; ")}; ${r}`), a.setAttribute("style", r);
				}
			}
		}
		r.push(e);
	}
	return r;
}
function wf(e) {
	for (let [t, n] of e) {
		if (!n) continue;
		let e = document.createElement("style");
		e.setAttribute(lu, "true"), e.textContent = n, t.append(e);
	}
}
//#endregion
//#region src/polyfill.ts
var Tf = (e, t) => {
	let n;
	switch (e) {
		case "start":
		case "self-start":
			n = 0;
			break;
		case "end":
		case "self-end":
			n = 100;
			break;
		default: typeof e == "number" && !Number.isNaN(e) && (n = e);
	}
	if (n !== void 0) return t ? 100 - n : n;
}, Ef = (e, t) => {
	let n;
	switch (e) {
		case "block":
		case "self-block":
			n = t ? "width" : "height";
			break;
		case "inline":
		case "self-inline": n = t ? "height" : "width";
	}
	return n;
}, Df = (e) => {
	switch (e) {
		case "top":
		case "bottom":
		case "inset-block-start":
		case "inset-block-end": return "y";
		case "left":
		case "right":
		case "inset-inline-start":
		case "inset-inline-end": return "x";
	}
	return null;
}, Of = (e) => {
	switch (e) {
		case "x": return "width";
		case "y": return "height";
	}
	return null;
}, kf = (e) => G(e, "display") === "inline", Af = (e, t) => (t === "x" ? ["border-left-width", "border-right-width"] : ["border-top-width", "border-bottom-width"]).reduce((t, n) => t + parseFloat(G(e, n)), 0) || 0, jf = (e, t) => parseFloat(getComputedStyle(e).getPropertyValue(`border-${t}-width`)) || 0, Mf = (e) => {
	let t = getComputedStyle(e), n = (e) => parseFloat(t.getPropertyValue(`margin-${e}`)) || 0;
	return {
		top: n("top"),
		right: n("right"),
		bottom: n("bottom"),
		left: n("left")
	};
}, Nf = function() {
	var e = l(function* ({ targetEl: e, targetProperty: t, anchorRect: n, anchorSide: r, anchorSize: i, fallback: a = null }) {
		if (!((i || r !== void 0) && e && n)) return a;
		if (i) {
			if (!lc(t)) return a;
			let r;
			switch (i) {
				case "width":
				case "height":
					r = i;
					break;
				default: {
					let t = G(e, "writing-mode");
					r = Ef(i, t.startsWith("vertical-") || t.startsWith("sideways-"));
				}
			}
			return r ? `${n[r]}px` : a;
		}
		if (r !== void 0) {
			let i, s, c = Df(t);
			if (!($s(t) && c && (!$s(r) || c === Df(r)))) return a;
			let l = [
				"top",
				"left",
				"inset-block-start",
				"inset-inline-start"
			], u = [
				"bottom",
				"right",
				"inset-block-end",
				"inset-inline-end"
			];
			switch (r) {
				case "left":
				case "top":
					i = 0;
					break;
				case "right":
				case "bottom":
					i = 100;
					break;
				case "center":
					i = 50;
					break;
				case "inside":
					i = l.includes(t) ? 0 : 100;
					break;
				case "outside":
					i = l.includes(t) ? 100 : 0;
					break;
				default: if (e) {
					var o;
					i = Tf(r, (yield (o = D.isRTL) == null ? void 0 : o.call(D, e)) || !1);
				}
			}
			let d = typeof i == "number" && !Number.isNaN(i), f = Of(c);
			if (d && f) {
				u.includes(t) && (s = yield zl(e));
				let r = n[c] + n[f] * (i / 100);
				switch (t) {
					case "bottom":
					case "inset-block-end": {
						if (!s) break;
						let e = s.clientHeight;
						if (e === 0 && kf(s)) {
							let t = Af(s, c);
							e = s.offsetHeight - t;
						}
						r = e - r;
						break;
					}
					case "right":
					case "inset-inline-end": {
						if (!s) break;
						let e = s.clientWidth;
						if (e === 0 && kf(s)) {
							let t = Af(s, c);
							e = s.offsetWidth - t;
						}
						r = e - r;
						break;
					}
				}
				return `${r}px`;
			}
		}
		return a;
	});
	return function(t) {
		return e.apply(this, arguments);
	};
}(), Pf = (e) => "targetUUID" in e, Ff = (e) => "uuid" in e, If = (e, t, n, r, i) => {
	switch (e) {
		case "start": return [t == null ? "0px" : t, "auto"];
		case "end": return ["auto", n == null ? "0px" : n];
		case "center": {
			let e = parseFloat(t == null ? "0" : t), a = parseFloat(n == null ? "0" : n);
			return [`${e + (r - e - a - i) / 2}px`, "auto"];
		}
	}
};
function Lf(e) {
	return Rf.apply(this, arguments);
}
function Rf() {
	return Rf = l(function* (e, t = !1) {
		let n = document.documentElement;
		for (let [r, i] of Object.entries(e)) for (let e of i) {
			let i = e.anchorEl, a = e.targetEl;
			if (i && a) {
				let o = su(a);
				if (Pf(e)) {
					let r = e.wrapperEl, o = r == null ? a : r, s = function() {
						var e = l(function* (e, t, n) {
							return e === 0 ? "0px" : yield Nf({
								targetEl: o,
								targetProperty: t,
								anchorRect: n,
								anchorSide: e
							});
						});
						return function(t, n, r) {
							return e.apply(this, arguments);
						};
					}();
					Ve(i, o, l(function* () {
						let t = G(a, Du);
						r ? r.setAttribute(Ou, t) : a.setAttribute(ku, t);
						let c = yield D.getElementRects({
							reference: i,
							floating: o,
							strategy: su(o)
						}), l = e.insets, u = yield s(l.block[0], "top", c.reference), d = yield s(l.block[1], "bottom", c.reference), f = yield s(l.inline[0], "left", c.reference), p = yield s(l.inline[1], "right", c.reference), m, h, g, _;
						if (r) [m, h, g, _] = [
							u,
							d,
							f,
							p
						], n.style.setProperty(`${e.targetUUID}-justify-self`, e.alignments.inline), n.style.setProperty(`${e.targetUUID}-align-self`, e.alignments.block);
						else {
							let t = yield zl(a), n = Mf(a);
							[m, h] = If(e.alignments.block, u, d, t.clientHeight, c.floating.height + n.top + n.bottom), [g, _] = If(e.alignments.inline, f, p, t.clientWidth, c.floating.width + n.left + n.right);
						}
						n.style.setProperty(`${e.targetUUID}-top`, m || null), n.style.setProperty(`${e.targetUUID}-left`, g || null), n.style.setProperty(`${e.targetUUID}-right`, _ || null), n.style.setProperty(`${e.targetUUID}-bottom`, h || null);
					}), { animationFrame: t });
				} else Ve(i, a, l(function* () {
					let t = yield D.getElementRects({
						reference: i,
						floating: a,
						strategy: o
					}), s = yield Nf({
						targetEl: a,
						targetProperty: r,
						anchorRect: t.reference,
						anchorSide: e.anchorSide,
						anchorSize: e.anchorSize,
						fallback: e.fallbackValue
					});
					n.style.setProperty(e.uuid, s);
				}), { animationFrame: t });
			} else if (Ff(e)) {
				let t = yield Nf({
					targetProperty: r,
					anchorSide: e.anchorSide,
					anchorSize: e.anchorSize,
					fallback: e.fallbackValue
				});
				n.style.setProperty(e.uuid, t);
			}
		}
	}), Rf.apply(this, arguments);
}
function zf(e, t) {
	let n = e.getBoundingClientRect(), r = Mf(e), i = {
		top: n.top - r.top,
		bottom: n.bottom + r.bottom,
		left: n.left - r.left,
		right: n.right + r.right
	}, a = t === document.documentElement ? {
		top: 0,
		left: 0,
		right: document.documentElement.clientWidth,
		bottom: document.documentElement.clientHeight
	} : (() => {
		let e = t.getBoundingClientRect();
		return {
			top: e.top + jf(t, "top"),
			left: e.left + jf(t, "left"),
			right: e.right - jf(t, "right"),
			bottom: e.bottom - jf(t, "bottom")
		};
	})();
	return {
		top: a.top - i.top,
		bottom: i.bottom - a.bottom,
		left: a.left - i.left,
		right: i.right - a.right
	};
}
function Bf(e, t) {
	return Vf.apply(this, arguments);
}
function Vf() {
	return Vf = l(function* (e, t, n = !1) {
		if (!t.length) return;
		let r = document.querySelectorAll(e);
		for (let e of r) {
			let r = !1, i = yield zl(e);
			Ve({}, e, l(function* () {
				if (r) return;
				r = !0, e.removeAttribute("data-anchor-polyfill");
				let n = zf(e, i);
				if (Object.values(n).every((e) => e <= 0)) {
					e.removeAttribute("data-anchor-polyfill-last-successful"), r = !1;
					return;
				}
				for (let [n, { uuid: a }] of t.entries()) {
					e.setAttribute("data-anchor-polyfill", a);
					let o = zf(e, i);
					if (Object.values(o).every((e) => e <= 0)) {
						e.setAttribute("data-anchor-polyfill-last-successful", a), r = !1;
						break;
					}
					if (n === t.length - 1) {
						let t = e.getAttribute("data-anchor-polyfill-last-successful");
						t ? e.setAttribute("data-anchor-polyfill", t) : e.removeAttribute("data-anchor-polyfill"), r = !1;
						break;
					}
				}
			}), {
				animationFrame: n,
				layoutShift: !1
			});
		}
	}), Vf.apply(this, arguments);
}
function Hf(e) {
	return Uf.apply(this, arguments);
}
function Uf() {
	return Uf = l(function* (e, t = !1) {
		for (let r of Object.values(e)) {
			var n;
			yield Lf((n = r.declarations) == null ? {} : n, t);
		}
		for (let [n, i] of Object.entries(e)) {
			var r;
			yield Bf(n, (r = i.fallbacks) == null ? [] : r, t);
		}
	}), Uf.apply(this, arguments);
}
function Wf(e = {}) {
	var t;
	let n = typeof e == "boolean" ? { useAnimationFrame: e } : e, r = n.useAnimationFrame === void 0 ? !!window.UPDATE_ANCHOR_ON_ANIMATION_FRAME : n.useAnimationFrame;
	return Array.isArray(n.elements) || (n.elements = void 0), (!Array.isArray(n.roots) || n.roots.length === 0) && (n.roots = [document]), Object.assign(n, {
		useAnimationFrame: r,
		positionAreaContainingBlock: (t = n.positionAreaContainingBlock) == null || t
	});
}
function Gf(e) {
	return Kf.apply(this, arguments);
}
function Kf() {
	return Kf = l(function* (e) {
		let t = Wf(e == null ? window.ANCHOR_POSITIONING_POLYFILL_OPTIONS : e), n = yield wu(t), r = {}, i, a;
		ou();
		try {
			mu(n, t.roots) && (n = Cf(n, void 0, t.roots));
			let e = yield bf(n, t);
			r = e.rules, i = e.inlineStyles, a = e.positionAreaStyles;
		} catch (e) {
			throw au(), e;
		}
		return Object.values(r).length && (Cf(n, i, t.roots), wf(a), yield Hf(r, t.useAnimationFrame)), r;
	}), Kf.apply(this, arguments);
}
//#endregion
//#region src/index.ts
typeof window < "u" && (document.readyState === "complete" ? Gf() : window.addEventListener("load", () => {
	Gf();
}));
//#endregion

