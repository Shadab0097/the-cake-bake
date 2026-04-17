/**
 * WhatsApp notification template name mapping and parameter builders
 */

const TEMPLATES = {
  order_confirmed: {
    name: 'order_confirmed',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      total: (order.total / 100).toFixed(2),
      deliveryDate: new Date(order.deliveryDate).toLocaleDateString('en-IN'),
      itemCount: order.items.length.toString(),
    }),
  },

  order_details: {
    name: 'order_details',
    buildParams: (order) => {
      const itemsList = order.items
        .map((item) => `${item.name} (${item.weight}) x${item.quantity}`)
        .join(', ');
      return {
        orderNumber: order.orderNumber,
        items: itemsList,
        subtotal: (order.subtotal / 100).toFixed(2),
        deliveryCharge: (order.deliveryCharge / 100).toFixed(2),
        discount: (order.discount / 100).toFixed(2),
        total: (order.total / 100).toFixed(2),
        address: `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city} - ${order.shippingAddress.pincode}`,
        deliveryDate: new Date(order.deliveryDate).toLocaleDateString('en-IN'),
        deliverySlot: order.deliverySlot?.label || 'Standard',
      };
    },
  },

  payment_success: {
    name: 'payment_success',
    buildParams: (order, payment) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      amount: (order.total / 100).toFixed(2),
      paymentId: payment?.razorpayPaymentId || '',
      method: payment?.method || 'Online',
    }),
  },

  payment_failed: {
    name: 'payment_failed',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      amount: (order.total / 100).toFixed(2),
    }),
  },

  order_preparing: {
    name: 'order_preparing',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
    }),
  },

  order_packed: {
    name: 'order_packed',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
    }),
  },

  order_dispatched: {
    name: 'order_dispatched',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      deliverySlot: order.deliverySlot?.label || 'Today',
    }),
  },

  out_for_delivery: {
    name: 'out_for_delivery',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
    }),
  },

  order_delivered: {
    name: 'order_delivered',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
    }),
  },

  order_cancelled: {
    name: 'order_cancelled',
    buildParams: (order) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      reason: 'As per your request',
    }),
  },

  refund_initiated: {
    name: 'refund_initiated',
    buildParams: (order, payment) => ({
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      refundAmount: ((payment?.refundAmount || order.total) / 100).toFixed(2),
    }),
  },
};

module.exports = TEMPLATES;
