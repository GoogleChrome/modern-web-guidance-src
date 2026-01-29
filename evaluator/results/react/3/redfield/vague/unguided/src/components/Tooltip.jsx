import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
} from '@floating-ui/react';
import { useRef, useState } from 'react';

/**
 * Modern Tooltip component using floating-ui
 * @param {Object} props
 * @param {React.ReactNode} props.children - The trigger element
 * @param {React.ReactNode} props.content - The tooltip content
 * @param {string} [props.placement='top'] - Preferred placement
 */
export function Tooltip({ children, content, placement = 'top' }) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context, middlewareData, placement: finalPlacement } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({
        fallbackAxisSideDirection: 'start',
      }),
      shift(),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[finalPlacement.split('-')[0]];

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className="tooltip-trigger-wrapper"
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="modern-tooltip"
          >
            {content}
            <div
              ref={arrowRef}
              className="modern-tooltip-arrow"
              style={{
                left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
                top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
                right: '',
                bottom: '',
                [staticSide]: '-6px', // Half of 12px (approx) to overlap nicely
              }}
            />
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
