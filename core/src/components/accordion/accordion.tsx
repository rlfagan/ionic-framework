import { Component, ComponentInterface, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';

import { Color } from '../../interface';
import { addEventListener, raf, removeEventListener, transitionEndAsync } from '../../utils/helpers';

const enum AccordionState {
  Collapsed = 1 << 0,
  Collapsing = 1 << 1,
  Expanded = 1 << 2,
  Expanding = 1 << 3
}

/**
 * @virtualProp {"ios" | "md"} mode - The mode determines which platform styles to use.
 *
 * @slot header - Content is placed at the top and is used to
 * expand or collapse the accordion item.
 * @slot content - Content is placed below the header and is
 * shown or hidden based on expanded state.
 *
 * @part header - The wrapper element for the header slot.
 * @part content - The wrapper element for the content slot.
 * @part expanded - The expanded element. Can be used in combination
 * with the `header` and `content` parts (i.e. `::part(header expanded)`).
 */
@Component({
  tag: 'ion-accordion',
  styleUrl: 'accordion.scss',
  shadow: {
    delegatesFocus: true
  }
})
export class Accordion implements ComponentInterface {
  private accordionGroupEl?: HTMLIonAccordionGroupElement | null;
  private updateListener = () => this.updateState(false);
  private contentEl: HTMLDivElement | undefined;
  private contentElWrapper: HTMLDivElement | undefined;

  @Element() el?: HTMLElement;

  @State() state: AccordionState = AccordionState.Collapsed;
  @State() isNext = false;
  @State() isPrevious = false;

  /**
   * The color to use from your application's color palette.
   * Default options are: `"primary"`, `"secondary"`, `"tertiary"`, `"success"`, `"warning"`, `"danger"`, `"light"`, `"medium"`, and `"dark"`.
   * For more information on colors, see [theming](/docs/theming/basics).
   */
  @Prop() color?: Color;

  /**
   * The value of the accordion.
   */
  @Prop() value?: string;

  /**
   * If `true`, the accordion cannot be interacted with.
   */
  @Prop() disabled = false;

  /**
   * If `true`, the accordion cannot be interacted with,
   * but does not alter the opacity.
   */
  @Prop() readonly = false;

  /**
   * Emitted when the accordion loses focus.
   */
  @Event() ionBlur!: EventEmitter<void>;

  /**
   * Emitted when the accordion has focus.
   */
  @Event() ionFocus!: EventEmitter<void>;

  connectedCallback() {
    const accordionGroupEl = this.accordionGroupEl = this.el && this.el.closest('ion-accordion-group');
    if (accordionGroupEl) {
      this.updateState(true);
      addEventListener(accordionGroupEl, 'ionChange', this.updateListener);
    }
  }

  disconnectedCallback() {
    const accordionGroupEl = this.accordionGroupEl;
    if (accordionGroupEl) {
      removeEventListener(accordionGroupEl, 'ionChange', this.updateListener);
    }
  }

  private expandAccordion = (initialUpdate = false) => {
    if (initialUpdate) {
      this.state = AccordionState.Expanded;
      return;
    }

    if (this.state === AccordionState.Expanded) { return; }

    const { contentEl, contentElWrapper } = this;
    if (contentEl === undefined || contentElWrapper === undefined) { return; }

    this.state = AccordionState.Expanding;

    raf(async () => {
      const contentHeight = contentElWrapper.offsetHeight;
      const waitForTransition = transitionEndAsync(contentEl, 50000);
      contentEl.style.setProperty('max-height', `${contentHeight}px`);

      /**
       * Force a repaint. We can't use an raf
       * here as it could cause the collapse animation
       * to get out of sync with the other
       * accordion's expand animation.
       */
      // tslint:disable-next-line
      void contentEl.offsetHeight;

      await waitForTransition;

      raf(() => {
        this.state = AccordionState.Expanded;
        contentEl.style.removeProperty('max-height');
      });
    });
  }

  private collapseAccordion = (initialUpdate = false) => {
    if (initialUpdate) {
      this.state = AccordionState.Collapsed;
      return;
    }

    if (this.state === AccordionState.Collapsed) { return; }

    const { contentEl } = this;
    if (contentEl === undefined) { return; }

    raf(async () => {
      const contentHeight = contentEl.offsetHeight;
      contentEl.style.setProperty('max-height', `${contentHeight}px`);

      /**
       * Force a repaint. We can't use an raf
       * here as it could cause the collapse animation
       * to get out of sync with the other
       * accordion's expand animation.
       */
      // tslint:disable-next-line
      void contentEl.offsetHeight;

      const waitForTransition = transitionEndAsync(contentEl, 50000);
      this.state = AccordionState.Collapsing;

      raf(async () => {
        await waitForTransition;

        this.state = AccordionState.Collapsed;
        contentEl.style.removeProperty('max-height');
      });
    });
  }

  private updateState = async (initialUpdate = false) => {
    const accordionGroup = this.accordionGroupEl;
    const accordionValue = this.value;

    if (accordionValue === undefined || !accordionGroup) { return; }

    const value = accordionGroup.value;

    const shouldExpand = (Array.isArray(value)) ? value.includes(accordionValue) : value === accordionValue;

    if (shouldExpand) {
      this.expandAccordion(initialUpdate);
    } else {
      this.collapseAccordion(initialUpdate);

      /**
       * When using popout or inset,
       * the collapsed accordion items
       * may need additional border radius
       * applied. Check to see if the
       * next or previous accordion is selected.
       */
      const nextAccordion = this.getNextSibling();
      const nextAccordionValue = nextAccordion && nextAccordion.value;

      if (nextAccordionValue !== undefined) {
      this.isPrevious = (Array.isArray(value)) ? value.includes(nextAccordionValue) : value === nextAccordionValue;
      }

      const previousAccordion = this.getPreviousSibling();
      const previousAccordionValue = previousAccordion && previousAccordion.value;

      if (previousAccordionValue !== undefined) {
        this.isNext = (Array.isArray(value)) ? value.includes(previousAccordionValue) : value === previousAccordionValue;
      }
    }
  }

  private getNextSibling = () => {
    if (!this.el) { return; }

    const nextSibling = this.el.nextElementSibling;

    if (nextSibling?.tagName !== 'ION-ACCORDION') { return; }

    return nextSibling as HTMLIonAccordionElement;
  }

  private getPreviousSibling = () => {
    if (!this.el) { return; }

    const previousSibling = this.el.previousElementSibling;

    if (previousSibling?.tagName !== 'ION-ACCORDION') { return; }

    return previousSibling as HTMLIonAccordionElement;
  }

  private toggleExpanded() {
    const { accordionGroupEl, value, state } = this;
    if (accordionGroupEl) {
      /**
       * Because the accordion group may or may
       * not allow multiple accordions open, we
       * need to request the toggling of this
       * accordion and the accordion group will
       * make the decision on whether or not
       * to allow it.
       */
      const expand = state === AccordionState.Collapsed;
      accordionGroupEl.requestAccordionToggle(value, expand);
    }
  }

  render() {
    const { disabled, readonly } = this;
    const expanded = this.state === AccordionState.Expanded;
    const headerPart = expanded ? 'header expanded' : 'header';
    const contentPart = expanded ? 'content expanded' : 'content';

    return (
      <Host
        class={{
          'accordion-expanding': this.state === AccordionState.Expanding,
          'accordion-expanded': this.state === AccordionState.Expanded,
          'accordion-collapsing': this.state === AccordionState.Collapsing,
          'accordion-collapsed': this.state === AccordionState.Collapsed,

          'accordion-next': this.isNext,
          'accordion-previous': this.isPrevious,

          'accordion-disabled': disabled,
          'accordion-readonly': readonly,
        }}
      >
        <div
          onClick={() => this.toggleExpanded()}
          id="header"
          part={headerPart}
          aria-expanded={expanded ? 'true' : 'false'}
          aria-controls="content"
        >
          <slot name="header"></slot>
        </div>

        <div
          id="content"
          part={contentPart}
          role="region"
          aria-labelledby="header"
          ref={contentEl => this.contentEl = contentEl}
        >
          <div id="content-wrapper" ref={contentElWrapper => this.contentElWrapper = contentElWrapper}>
            <slot name="content"></slot>
          </div>
        </div>
      </Host>
    );
  }
}