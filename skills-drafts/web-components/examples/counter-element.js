// Example Web Component: Simple Counter
class MyCounter extends HTMLElement {
  static get observedAttributes() {
    return ['count'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._count = 0;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'count') {
      this._count = parseInt(newValue, 10) || 0;
      this.render();
    }
  }

  increment() {
    this.setAttribute('count', this._count + 1);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; padding: 1rem; border: 1px solid #ccc; }
        button { cursor: pointer; }
      </style>
      <div>Count: ${this._count}</div>
      <button id="inc-btn">Increment</button>
    `;
    this.shadowRoot.getElementById('inc-btn').onclick = () => this.increment();
  }
}

customElements.define('my-counter', MyCounter);
