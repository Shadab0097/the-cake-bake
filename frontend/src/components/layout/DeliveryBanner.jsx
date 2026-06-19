'use client';

import { useDispatch, useSelector } from 'react-redux';
import { FiMapPin } from 'react-icons/fi';
import { openDeliveryPopover } from '@/store/slices/uiSlice';

/**
 * Slim, dismissable-feeling notice shown when the chosen pincode isn't
 * serviceable yet. Never blocks browsing — it only informs and offers a way to
 * change the location (opens the header widget).
 */
export default function DeliveryBanner() {
  const dispatch = useDispatch();
  const { status, pincode, city } = useSelector((s) => s.delivery);

  if (status !== 'coming_soon' && status !== 'unavailable') return null;

  const isSoon = status === 'coming_soon';

  return (
    <div
      role="status"
      className={`w-full text-center px-4 py-2 text-xs sm:text-sm ${
        isSoon ? 'bg-warning-light text-on-surface-variant' : 'bg-error-container/40 text-on-surface-variant'
      }`}
    >
      <FiMapPin className="inline-block w-4 h-4 mr-1.5 -mt-0.5 text-pink-deep" />
      {isSoon ? (
        <span>
          Delivery to <strong>{city || `pincode ${pincode}`}</strong> is launching soon — browse now, order shortly.
        </span>
      ) : (
        <span>
          We don’t deliver to <strong>{pincode}</strong> yet. Browse freely, or
        </span>
      )}
      <button
        type="button"
        onClick={() => dispatch(openDeliveryPopover())}
        className="ml-1.5 font-semibold text-pink-deep underline hover:no-underline"
      >
        try another pincode
      </button>
    </div>
  );
}
