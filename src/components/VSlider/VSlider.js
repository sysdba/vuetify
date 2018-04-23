// Styles
import '../../stylus/components/_sliders.styl'

// Components
import VLabel from '../VLabel'
import { VScaleTransition } from '../transitions'

// Extensions
import VInput from '../VInput'

// Directives
import ClickOutside from '../../directives/click-outside'

// Utilities
import {
  addOnceEventListener,
  createRange,
  keyCodes,
  deepEqual
} from '../../util/helpers'
import { consoleWarn } from '../../util/console'

export default {
  name: 'v-slider',

  extends: VInput,

  directives: { ClickOutside },

  data: vm => ({
    activeThumb: 0,
    app: {},
    defaultColor: 'primary',
    isActive: false,
    keyPressed: 0,
    lazyValue: vm.value || Number(vm.min),
    oldValue: null
  }),

  props: {
    inverseLabel: Boolean,
    label: String,
    min: {
      type: [Number, String],
      default: 0
    },
    max: {
      type: [Number, String],
      default: 100
    },
    range: Boolean,
    step: {
      type: [Number, String],
      default: 1
    },
    ticks: {
      type: [Boolean, String],
      default: false,
      validator: v => typeof v === 'boolean' || v === 'always'
    },
    thumbColor: {
      type: String,
      default: null
    },
    thumbLabel: {
      type: [Boolean, String],
      default: null,
      validator: v => typeof v === 'boolean' || v === 'always'
    },
    trackColor: {
      type: String,
      default: null
    },
    value: [Number, String]
  },

  computed: {
    classes () {
      return {
        'v-input--slider': true,
        'v-input--slider--ticks': this.showTicks,
        'v-input--slider--inverse-label': this.inverseLabel
      }
    },
    showTicks () {
      return !this.disabled && this.stepNumeric && !!this.ticks
    },
    showThumbLabel () {
      return !this.disabled &&
        (!!this.thumbLabel || this.thumbLabel === '')
    },
    computedColor () {
      if (this.disabled) return null
      return this.validationState || this.color || this.defaultColor
    },
    computedTrackColor () {
      return this.disabled ? null : (this.trackColor || null)
    },
    computedThumbColor () {
      if (this.disabled || !this.isDirty) return null
      return this.validationState || this.thumbColor || this.color || this.defaultColor
    },
    internalValue: {
      get () {
        return this.lazyValue
      },
      set (val) {
        const { min, max } = this

        // Round value to ensure the
        // entire slider range can
        // be selected with step
        const value = this.roundValue(Math.min(Math.max(val, min), max))

        if (value === this.lazyValue) return

        this.lazyValue = value

        this.$emit('input', value)
        this.validate()
      }
    },
    stepNumeric () {
      return this.step > 0 ? parseFloat(this.step) : 1
    },
    trackFillStyles () {
      return {
        transition: this.trackTransition,
        width: `${this.inputWidth}%`,
        [this.$vuetify.rtl ? 'right' : 'left']: 0
      }
    },
    trackPadding () {
      if (this.isActive) return 0

      return 7 + (this.disabled ? 3 : 0)
    },
    trackStyles () {
      return {
        transition: this.trackTransition,
        [this.$vuetify.rtl ? 'right' : 'left']: `${this.trackPadding}px`,
        width: '100%'
      }
    },
    trackTransition () {
      return this.keyPressed >= 2 ? 'none' : ''
    },
    numTicks () {
      return Math.ceil((this.max - this.min) / this.stepNumeric)
    },
    inputWidth () {
      return (this.roundValue(this.internalValue) - this.min) / (this.max - this.min) * 100
    },
    isDirty () {
      return this.internalValue > this.min
    }
  },

  watch: {
    min (val) {
      val > this.internalValue && this.$emit('input', parseFloat(val))
    },
    max (val) {
      val < this.internalValue && this.$emit('input', parseFloat(val))
    },
    value (val) {
      this.internalValue = val
    }
  },

  mounted () {
    // Without a v-app, iOS does not work with body selectors
    this.app = document.querySelector('[data-app]') ||
      consoleWarn('Missing v-app or a non-body wrapping element with the [data-app] attribute', this)
  },

  methods: {
    genDefaultSlot () {
      const children = [this.genLabel()]
      const slider = this.genSlider()

      this.inverseLabel
        ? children.unshift(slider)
        : children.push(slider)

      return children
    },
    genLabel () {
      if (!this.label) return null

      const data = {
        props: {
          color: this.validationState,
          focused: !!this.validationState
        }
      }

      if (this.$attrs.id) data.props.for = this.$attrs.id

      return this.$createElement(VLabel, data, this.$slots.label || this.label)
    },
    genListeners () {
      return Object.assign({}, {
        blur: this.onBlur,
        click: this.onSliderClick,
        focus: this.onFocus,
        keydown: this.onKeyDown,
        keyup: this.onKeyUp
      })
    },
    genInput () {
      return this.$createElement('input', {
        attrs: {
          'aria-label': this.label,
          name: this.name,
          role: 'slider',
          tabindex: this.disabled ? -1 : undefined,
          type: 'slider',
          value: this.internalValue
        },
        on: this.genListeners(),
        ref: 'input'
      })
    },
    genSlider () {
      return this.$createElement('div', {
        staticClass: 'v-slider',
        'class': {
          'v-slider--is-active': this.isActive
        },
        directives: [{
          name: 'click-outside',
          value: this.onBlur
        }]
      }, this.genChildren())
    },
    genChildren () {
      return [
        this.genInput(),
        this.genTrackContainer(),
        this.genSteps(),
        this.genThumbContainer(
          this.internalValue,
          this.inputWidth,
          this.isFocused || this.isActive,
          e => {
            this.isActive = true
            // Wait for data to persist
            this.onMouseDown(e)
          }
        )
      ]
    },
    genSteps () {
      if (!this.step || !this.showTicks) return null

      const ticks = createRange(this.numTicks + 1).map(i => {
        const span = this.$createElement('span', {
          key: i,
          staticClass: 'v-slider__tick',
          class: {
            'v-slider__tick--always-show': this.ticks === 'always'
          },
          style: {
            left: `${i * (100 / this.numTicks)}%`
          }
        })

        return i === 0 && !this.isDirty ? null : span
      })

      return this.$createElement('div', {
        staticClass: 'v-slider__ticks-container'
      }, ticks)
    },
    genThumb () {
      return this.$createElement('div', {
        staticClass: 'v-slider__thumb',
        'class': this.addBackgroundColorClassChecks({}, this.computedThumbColor)
      })
    },
    genThumbContainer (value, valueWidth, isActive, onDrag) {
      const children = [this.genThumb()]

      const thumbLabelContent = this.getLabel(value)
      this.showThumbLabel && children.push(this.genThumbLabel(thumbLabelContent))

      return this.$createElement('div', {
        staticClass: 'v-slider__thumb-container',
        'class': this.addTextColorClassChecks({
          'v-slider__thumb-container--is-active': isActive,
          'v-slider__thumb-container--show-label': this.showThumbLabel
        }, this.computedThumbColor),
        style: {
          transition: this.trackTransition,
          left: `${this.$vuetify.rtl ? 100 - valueWidth : valueWidth}%`
        },
        on: {
          touchstart: onDrag,
          mousedown: onDrag
        }
      }, children)
    },
    genThumbLabel (content) {
      return this.$createElement(VScaleTransition, {
        props: { origin: 'bottom center' }
      }, [
        this.$createElement('div', {
          staticClass: 'v-slider__thumb-label__container',
          directives: [
            {
              name: 'show',
              value: this.isFocused || this.isActive || this.thumbLabel === 'always'
            }
          ]
        }, [
          this.$createElement('div', {
            staticClass: 'v-slider__thumb-label',
            'class': this.addBackgroundColorClassChecks({}, this.computedThumbColor)
          }, [content])
        ])
      ])
    },
    genTrackContainer () {
      const children = [
        this.$createElement('div', {
          staticClass: 'v-slider__track',
          'class': this.addBackgroundColorClassChecks({}, this.computedTrackColor),
          style: this.trackStyles
        }),
        this.$createElement('div', {
          staticClass: 'v-slider__track-fill',
          'class': this.addBackgroundColorClassChecks(),
          style: this.trackFillStyles
        })
      ]

      return this.$createElement('div', {
        staticClass: 'v-slider__track__container',
        ref: 'track'
      }, children)
    },
    getLabel (value) {
      return this.$scopedSlots['thumb-label']
        ? this.$scopedSlots['thumb-label']({ value })
        : this.$createElement('span', {}, value)
    },
    onBlur (e) {
      this.isActive = false
      this.isFocused = false
      this.$emit('blur', e)
    },
    onFocus (e) {
      this.isFocused = true
      this.$emit('focus', e)
    },
    onMouseDown (e) {
      this.oldValue = this.internalValue
      this.keyPressed = 2
      const options = { passive: true }
      this.isActive = true

      if ('touches' in e) {
        this.app.addEventListener('touchmove', this.onMouseMove, options)
        addOnceEventListener(this.app, 'touchend', this.onMouseUp)
      } else {
        this.app.addEventListener('mousemove', this.onMouseMove, options)
        addOnceEventListener(this.app, 'mouseup', this.onMouseUp)
      }

      this.$emit('start', this.internalValue)
    },
    onMouseUp () {
      this.keyPressed = 0
      const options = { passive: true }
      this.isActive = false
      this.app.removeEventListener('touchmove', this.onMouseMove, options)
      this.app.removeEventListener('mousemove', this.onMouseMove, options)

      this.$emit('end', this.internalValue)
      if (!deepEqual(this.oldValue, this.internalValue)) {
        this.$emit('change', this.internalValue)
      }
    },
    onMouseMove (e) {
      const { value, isInsideTrack } = this.parseMouseMove(e)

      if (isInsideTrack) {
        this.setInternalValue(value)
      }
    },
    onKeyDown (e) {
      const value = this.parseKeyDown(e)

      if (value == null) return

      this.setInternalValue(value)
      this.$emit('change', value)
    },
    onKeyUp () {
      this.keyPressed = 0
    },
    onSliderClick (e) {
      this.onMouseMove(e)
      this.$emit('change', this.internalValue)
    },
    parseMouseMove (e) {
      const {
        left: offsetLeft,
        width: trackWidth
      } = this.$refs.track.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      let left = Math.min(Math.max((clientX - offsetLeft) / trackWidth, 0), 1)

      if (this.$vuetify.rtl) left = 1 - left

      const isInsideTrack = clientX >= offsetLeft - 8 && clientX <= offsetLeft + trackWidth + 8
      const value = parseFloat(this.min) + left * (this.max - this.min)

      return { value, isInsideTrack }
    },
    parseKeyDown (e, value = this.internalValue) {
      if (this.disabled) return

      const { pageup, pagedown, end, home, left, right, down, up } = keyCodes

      if (![pageup, pagedown, end, home, left, right, down, up].includes(e.keyCode)) return

      e.preventDefault()
      const step = this.stepNumeric
      const steps = (this.max - this.min) / step
      if ([left, right, down, up].includes(e.keyCode)) {
        this.keyPressed += 1

        const increase = this.$vuetify.rtl ? [left, up] : [right, up]
        let direction = increase.includes(e.keyCode) ? 1 : -1
        const multiplier = e.shiftKey ? 3 : (e.ctrlKey ? 2 : 1)

        value = value + (direction * step * multiplier)
      } else if (e.keyCode === home) {
        value = parseFloat(this.min)
      } else if (e.keyCode === end) {
        value = parseFloat(this.max)
      } else /* if (e.keyCode === keyCodes.pageup || e.keyCode === pagedown) */ {
        // Page up/down
        const direction = e.keyCode === pagedown ? 1 : -1
        value = value - (direction * step * (steps > 100 ? steps / 10 : 10))
      }

      return value
    },
    roundValue (value) {
      // Format input value using the same number
      // of decimals places as in the step prop
      const trimmedStep = this.step.toString().trim()
      const decimals = trimmedStep.indexOf('.') > -1
        ? (trimmedStep.length - trimmedStep.indexOf('.') - 1)
        : 0

      const newValue = 1 * Math.round(value / this.stepNumeric) * this.stepNumeric

      return parseFloat(Math.min(newValue, this.max).toFixed(decimals))
    },
    setInternalValue (value) {
      this.internalValue = value
    }
  }
}
