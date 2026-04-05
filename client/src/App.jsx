import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import {
  closeSession,
  confirmOrderPayment,
  createFloor,
  createOrder,
  createProduct,
  createTable,
  exportSalesReport,
  getActiveSession,
  getCustomerDisplayLatest,
  getCustomerOrderStatus,
  getFloors,
  getKitchenTickets,
  getPublicKitchenTickets,
  getMe,
  getPendingVerificationOrders,
  getPaymentMethods,
  getProducts,
  rejectPendingOrder,
  getSalesReport,
  generateUpiQr,
  login,
  openSession,
  sendOrderToKitchen,
  signup,
  updatePaymentMethod,
  updateKitchenTicketStatus,
  updateTable,
  updatePublicKitchenTicketStatus,
} from './lib/api'

const REPORT_PRESETS_KEY = 'odoo_pos_report_presets'

function App() {
  const [authRoleChoice, setAuthRoleChoice] = useState(null)
  const [mode, setMode] = useState('login')
  const [token, setToken] = useState(localStorage.getItem('odoo_pos_token') || '')
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('staff@odoo.cafe')
  const [username, setUsername] = useState('barista')
  const [password, setPassword] = useState('barista123')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [session, setSession] = useState(null)
  const [view, setView] = useState('pos')
  const [floors, setFloors] = useState([])
  const [selectedFloorId, setSelectedFloorId] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [products, setProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(null)
  const [orderLines, setOrderLines] = useState([])
  const [lastTicket, setLastTicket] = useState(null)
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null)
  const [upiQr, setUpiQr] = useState(null)
  const [paymentConfirmation, setPaymentConfirmation] = useState(null)
  const [kitchenTickets, setKitchenTickets] = useState([])
  const [kitchenFilter, setKitchenFilter] = useState('')
  const [customerTableId, setCustomerTableId] = useState(null)
  const [customerDisplay, setCustomerDisplay] = useState(null)
  const [reportFilters, setReportFilters] = useState({
    period: 'all',
    fromDate: '',
    toDate: '',
    sessionId: '',
    responsibleId: '',
    productId: '',
  })
  const [salesReport, setSalesReport] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [reportPresets, setReportPresets] = useState([])
  const [selectedPresetName, setSelectedPresetName] = useState('')
  const [customerTableIdSelfOrder, setCustomerTableIdSelfOrder] = useState(null)
  const [customerOrderCart, setCustomerOrderCart] = useState([])
  const [customerOrderRef, setCustomerOrderRef] = useState(null)
  const [customerOrderStatus, setCustomerOrderStatus] = useState(null)
  const [pendingVerificationOrders, setPendingVerificationOrders] = useState([])
  const [newFloorName, setNewFloorName] = useState('')
  const [newTableForm, setNewTableForm] = useState({
    floorId: '',
    tableNumber: '',
    seats: '2',
  })
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: '',
    price: '',
    unit: 'plate',
    taxRate: '5',
    description: '',
  })

  const isKitchenDisplayMode = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const appMode = import.meta.env.VITE_APP_MODE || ''
    if (appMode === 'kitchen') {
      return true
    }
    if (appMode === 'manager') {
      return false
    }

    const forceKitchenMode = import.meta.env.VITE_FORCE_KITCHEN_SCREEN === '1'
    if (forceKitchenMode) {
      return true
    }

    const kitchenPort = import.meta.env.VITE_KITCHEN_DISPLAY_PORT || '5175'
    const screen = new URLSearchParams(window.location.search).get('screen')
    const path = window.location.pathname.toLowerCase()
    const isKitchenPath = path === '/kitchen'
    const isKitchenPort = window.location.port === String(kitchenPort)
    const host = window.location.host.toLowerCase()
    const kitchenPortPattern = new RegExp(`(^|\\D)${String(kitchenPort)}(\\D|$)`)
    const hasKitchenPortHint = kitchenPortPattern.test(host)

    return screen === 'kitchen' || isKitchenPath || isKitchenPort || hasKitchenPortHint
  }, [])

  const kitchenAccessKey =
    import.meta.env.VITE_KITCHEN_DISPLAY_KEY || 'kitchen-display-dev-key'
  const isKitchenPublicMode = isKitchenDisplayMode && (!token || !user)

  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.id === selectedFloorId) || null,
    [floors, selectedFloorId],
  )

  const kitchenBoardColumns = useMemo(() => {
    const columns = [
      { key: 'TO_COOK', label: 'To Cook' },
      { key: 'PREPARING', label: 'Preparing' },
      { key: 'COMPLETED', label: 'Completed' },
    ]

    return columns.map((column) => ({
      ...column,
      tickets: kitchenTickets.filter((ticket) => ticket.ticket_status === column.key),
    }))
  }, [kitchenTickets])

  const orderSummary = useMemo(() => {
    const subtotal = orderLines.reduce(
      (total, item) => total + item.quantity * item.price,
      0,
    )
    const tax = orderLines.reduce(
      (total, item) => total + item.quantity * item.price * (item.taxRate / 100),
      0,
    )
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    }
  }, [orderLines])

  const enabledPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.is_enabled),
    [paymentMethods],
  )

  const selectedPaymentMethod = useMemo(
    () =>
      enabledPaymentMethods.find((method) => method.id === selectedPaymentMethodId) ||
      null,
    [enabledPaymentMethods, selectedPaymentMethodId],
  )

  const formatMoney = (amount) => `₹${Number(amount || 0).toFixed(2)}`
  const isCustomerUser = user?.role === 'customer'

  const formatOrderCustomer = (order) => {
    if (order.customer_username && order.customer_email) {
      return `${order.customer_username} (${order.customer_email})`
    }
    if (order.customer_username) {
      return order.customer_username
    }
    if (order.customer_email) {
      return order.customer_email
    }
    if (order.customer_id) {
      return `Customer #${order.customer_id}`
    }
    return 'Walk-in / legacy order'
  }

  const allTables = useMemo(
    () => floors.flatMap((floor) => floor.tables || []),
    [floors],
  )

  const customerSelectedTable = useMemo(
    () => allTables.find((table) => table.id === customerTableIdSelfOrder) || null,
    [allTables, customerTableIdSelfOrder],
  )

  const customerCartSummary = useMemo(() => {
    const subtotal = customerOrderCart.reduce(
      (total, item) => total + item.quantity * item.price,
      0,
    )
    const tax = customerOrderCart.reduce(
      (total, item) => total + item.quantity * item.price * (item.taxRate / 100),
      0,
    )
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    }
  }, [customerOrderCart])

  useEffect(() => {
    if (!token) {
      return
    }

    getMe(token)
      .then((me) => {
        setUser(me)
      })
      .catch(() => {
        localStorage.removeItem('odoo_pos_token')
        setToken('')
      })
  }, [token])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REPORT_PRESETS_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setReportPresets(parsed)
      }
    } catch {
      setReportPresets([])
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(REPORT_PRESETS_KEY, JSON.stringify(reportPresets))
  }, [reportPresets])

  const refreshMasterData = async () => {
    if (!token) {
      return
    }

    const [productsData, floorsData, methodsData] = await Promise.all([
      getProducts(token),
      getFloors(token),
      getPaymentMethods(token),
    ])
    setProducts(productsData)
    setFloors(floorsData)
    setPaymentMethods(methodsData)

    const enabledMethods = methodsData.filter((method) => method.is_enabled)
    if (enabledMethods.length === 0) {
      setSelectedPaymentMethodId(null)
    } else if (
      !enabledMethods.some((method) => method.id === selectedPaymentMethodId)
    ) {
      setSelectedPaymentMethodId(enabledMethods[0].id)
    }
    if (floorsData.length > 0 && !selectedFloorId) {
      setSelectedFloorId(floorsData[0].id)
    }
    if (!customerTableIdSelfOrder && floorsData[0]?.tables?.[0]) {
      setCustomerTableIdSelfOrder(floorsData[0].tables[0].id)
    }
  }

  useEffect(() => {
    if (!token || !user) {
      return
    }

    refreshMasterData().catch((err) => setError(err.message))
  }, [token, user])

  useEffect(() => {
    if (!token || !user) {
      return
    }

    getActiveSession(token)
      .then((active) => {
        if (active?.active && active?.session) {
          setSession(active.session)
        }
      })
      .catch(() => {
        // If this fails we still allow manual session opening.
      })
  }, [token, user])

  const refreshKitchenTickets = () => {
    if (!token) {
      return
    }
    getKitchenTickets(token, kitchenFilter)
      .then((tickets) => setKitchenTickets(tickets))
      .catch((err) => setError(err.message))
  }

  const refreshPublicKitchenTickets = () => {
    getPublicKitchenTickets(kitchenAccessKey, kitchenFilter)
      .then((tickets) => setKitchenTickets(tickets))
      .catch((err) => setError(err.message))
  }

  const refreshCustomerDisplay = () => {
    if (!token) {
      return
    }
    getCustomerDisplayLatest(token, customerTableId)
      .then((snapshot) => setCustomerDisplay(snapshot))
      .catch((err) => setError(err.message))
  }

  const refreshSalesReport = () => {
    if (!token) {
      return
    }
    getSalesReport(token, reportFilters)
      .then((report) => setSalesReport(report))
      .catch((err) => setError(err.message))
  }

  const refreshPendingVerificationOrders = () => {
    if (!token || isCustomerUser) {
      return
    }
    getPendingVerificationOrders(token, session?.session_id || null)
      .then((orders) => setPendingVerificationOrders(orders))
      .catch((err) => setError(err.message))
  }

  const handleExportReport = async (format) => {
    if (!token) {
      return
    }

    setError('')
    setIsExporting(true)
    try {
      const { blob, filename } = await exportSalesReport(token, reportFilters, format)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleReloadData = async () => {
    if (!token) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await refreshMasterData()
      refreshKitchenTickets()
      if (view === 'customer') {
        refreshCustomerDisplay()
      }
      if (view === 'reports') {
        refreshSalesReport()
      }
      refreshPendingVerificationOrders()
      setNotice('Data reloaded from backend.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleCloseRegister = async () => {
    if (!token || !session?.session_id) {
      return
    }

    const closingValue = window.prompt('Enter closing balance', '0')
    if (closingValue === null) {
      return
    }
    const parsed = Number(closingValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Closing balance must be a non-negative number.')
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      const closed = await closeSession(token, session.session_id, {
        closing_balance: parsed,
      })
      setSession(null)
      setOrderLines([])
      setPendingPaymentOrder(null)
      setPaymentConfirmation(null)
      setLastTicket(null)
      setSelectedTable(null)
      setNotice(
        `Session #${closed.session_id} closed. Sales: ${formatMoney(closed.closing_sales)}.`,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleSaveReportPreset = () => {
    const name = window.prompt('Preset name')?.trim()
    if (!name) {
      return
    }
    setReportPresets((prev) => {
      const next = prev.filter((preset) => preset.name !== name)
      return [...next, { name, filters: reportFilters }]
    })
    setSelectedPresetName(name)
  }

  const handleApplyReportPreset = () => {
    if (!selectedPresetName) {
      return
    }
    const preset = reportPresets.find((item) => item.name === selectedPresetName)
    if (!preset) {
      return
    }
    setReportFilters({
      period: preset.filters.period || 'all',
      fromDate: preset.filters.fromDate || '',
      toDate: preset.filters.toDate || '',
      sessionId: preset.filters.sessionId || '',
      responsibleId: preset.filters.responsibleId || '',
      productId: preset.filters.productId || '',
    })
  }

  const handleDeleteReportPreset = () => {
    if (!selectedPresetName) {
      return
    }
    setReportPresets((prev) =>
      prev.filter((preset) => preset.name !== selectedPresetName),
    )
    setSelectedPresetName('')
  }

  useEffect(() => {
    if (!token || !user) {
      return
    }
    refreshKitchenTickets()
  }, [token, user, kitchenFilter])

  useEffect(() => {
    if (!isKitchenPublicMode) {
      return
    }

    refreshPublicKitchenTickets()
    const poll = window.setInterval(() => {
      refreshPublicKitchenTickets()
    }, 4000)

    return () => window.clearInterval(poll)
  }, [isKitchenPublicMode, kitchenFilter, kitchenAccessKey])

  useEffect(() => {
    if (!isKitchenDisplayMode) {
      return
    }
    if (!isKitchenPublicMode && (!token || !user || isCustomerUser)) {
      return
    }

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
    })

    const refreshTickets = () => {
      if (isKitchenPublicMode) {
        refreshPublicKitchenTickets()
      } else {
        refreshKitchenTickets()
      }
    }

    socket.on('kitchen:ticket_created', refreshTickets)
    socket.on('kitchen:ticket_updated', refreshTickets)

    return () => {
      socket.off('kitchen:ticket_created', refreshTickets)
      socket.off('kitchen:ticket_updated', refreshTickets)
      socket.disconnect()
    }
  }, [
    token,
    user,
    isCustomerUser,
    isKitchenDisplayMode,
    isKitchenPublicMode,
    kitchenFilter,
    kitchenAccessKey,
  ])

  useEffect(() => {
    if (!token || !user || view !== 'customer') {
      return
    }

    refreshCustomerDisplay()
    const poll = window.setInterval(() => {
      refreshCustomerDisplay()
    }, 4000)
    return () => window.clearInterval(poll)
  }, [token, user, view, customerTableId])

  useEffect(() => {
    if (!token || !user || view !== 'reports') {
      return
    }
    refreshSalesReport()
  }, [token, user, view, reportFilters])

  useEffect(() => {
    if (!token || !user || !isCustomerUser || !customerOrderRef?.orderId) {
      return
    }

    const fetchStatus = () => {
      getCustomerOrderStatus(token, customerOrderRef.orderId)
        .then((snapshot) => setCustomerOrderStatus(snapshot))
        .catch((err) => setError(err.message))
    }

    fetchStatus()
    const poll = window.setInterval(fetchStatus, 4000)
    return () => window.clearInterval(poll)
  }, [token, user, isCustomerUser, customerOrderRef?.orderId])

  useEffect(() => {
    if (!token || !user || isCustomerUser) {
      return
    }

    refreshPendingVerificationOrders()
    const poll = window.setInterval(() => {
      refreshPendingVerificationOrders()
    }, 4000)
    return () => window.clearInterval(poll)
  }, [token, user, isCustomerUser, session?.session_id])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsBusy(true)

    try {
      const action = mode === 'login' ? login : signup
      const payload =
        mode === 'login'
          ? { email, password }
          : {
              email,
              username,
              password,
              role: authRoleChoice === 'customer' ? 'customer' : 'staff',
            }

      const response = await action(payload)

      if (authRoleChoice === 'manager' && response.user.role === 'customer') {
        throw new Error('This is a customer account. Choose Sign in as customer.')
      }
      if (authRoleChoice === 'customer' && response.user.role !== 'customer') {
        throw new Error('This account is not a customer account. Choose Sign in as manager.')
      }

      localStorage.setItem('odoo_pos_token', response.token)
      setToken(response.token)
      setUser(response.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleOpenSession = async () => {
    if (!token) {
      return
    }
    setError('')
    setIsBusy(true)
    try {
      const response = await openSession(token, {
        terminal_name: 'Main Register',
        opening_balance: 1500,
      })
      setSession(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const addProductToOrder = (product) => {
    setOrderLines((prevLines) => {
      const existingLine = prevLines.find((line) => line.productId === product.id)
      if (existingLine) {
        return prevLines.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      }

      return [
        ...prevLines,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
          taxRate: product.tax_rate,
        },
      ]
    })
  }

  const updateLineQuantity = (productId, nextQuantity) => {
    if (nextQuantity <= 0) {
      setOrderLines((prevLines) =>
        prevLines.filter((line) => line.productId !== productId),
      )
      return
    }

    setOrderLines((prevLines) =>
      prevLines.map((line) =>
        line.productId === productId
          ? { ...line, quantity: nextQuantity }
          : line,
      ),
    )
  }

  const handleSendToKitchen = async () => {
    if (!token || !session || !selectedTable || orderLines.length === 0) {
      setError('Open a session, pick a table and add at least one product.')
      return
    }

    setError('')
    setIsBusy(true)

    try {
      const order = await createOrder(token, {
        session_id: session.session_id,
        table_id: selectedTable.id,
        items: orderLines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
        })),
      })
      const ticket = await sendOrderToKitchen(token, order.order_id)
      setLastTicket(ticket)
      setPendingPaymentOrder({
        orderId: order.order_id,
        orderNumber: order.order_number,
        amount: order.total_amount,
      })
      setCustomerTableId(selectedTable.id)
      setUpiQr(null)
      setPaymentConfirmation(null)
      setOrderLines([])
      refreshPendingVerificationOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleGenerateUpiQr = async () => {
    if (!token || !pendingPaymentOrder) {
      return
    }
    setError('')
    setIsBusy(true)
    try {
      const qrPayload = await generateUpiQr(token, pendingPaymentOrder.orderId)
      setUpiQr(qrPayload)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!token || !pendingPaymentOrder || !selectedPaymentMethod) {
      setError('Send an order to kitchen and choose a payment method.')
      return
    }

    const isUpi = selectedPaymentMethod.method_type === 'UPI'
    if (isUpi && !upiQr?.payment_id) {
      setError('Generate UPI QR before confirming UPI payment.')
      return
    }

    setError('')
    setIsBusy(true)
    try {
      const payload = isUpi
        ? {
            payment_id: upiQr.payment_id,
            reference_code: `UPI_CONFIRMED_${pendingPaymentOrder.orderNumber}`,
          }
        : {
            payment_method_id: selectedPaymentMethod.id,
            reference_code: `POS_CONFIRMED_${pendingPaymentOrder.orderNumber}`,
          }

      const result = await confirmOrderPayment(
        token,
        pendingPaymentOrder.orderId,
        payload,
      )

      setPaymentConfirmation(result)
      setPendingPaymentOrder(null)
      setUpiQr(null)
      setSelectedTable(null)
      refreshKitchenTickets()
      refreshCustomerDisplay()
      refreshPendingVerificationOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('odoo_pos_token')
    setAuthRoleChoice(null)
    setToken('')
    setUser(null)
    setSession(null)
    setNotice('')
    setOrderLines([])
    setPendingPaymentOrder(null)
    setUpiQr(null)
    setPaymentConfirmation(null)
    setKitchenTickets([])
    setCustomerDisplay(null)
    setCustomerTableId(null)
    setCustomerTableIdSelfOrder(null)
    setCustomerOrderCart([])
    setCustomerOrderRef(null)
    setCustomerOrderStatus(null)
    setSelectedTable(null)
    setLastTicket(null)
  }

  const addProductToCustomerCart = (product) => {
    setCustomerOrderCart((prevLines) => {
      const existingLine = prevLines.find((line) => line.productId === product.id)

      if (existingLine) {
        return prevLines.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      }

      return [
        ...prevLines,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
          taxRate: product.tax_rate,
        },
      ]
    })
  }

  const updateCustomerCartQuantity = (productId, nextQuantity) => {
    if (nextQuantity <= 0) {
      setCustomerOrderCart((prevLines) =>
        prevLines.filter((line) => line.productId !== productId),
      )
      return
    }

    setCustomerOrderCart((prevLines) =>
      prevLines.map((line) =>
        line.productId === productId
          ? { ...line, quantity: nextQuantity }
          : line,
      ),
    )
  }

  const handlePlaceCustomerOrder = async () => {
    if (!token || !session?.session_id || !customerTableIdSelfOrder || customerOrderCart.length === 0) {
      setError('Select a table and add at least one item to place your order.')
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      const order = await createOrder(token, {
        session_id: session.session_id,
        table_id: customerTableIdSelfOrder,
        source: 'SELF_ORDER',
        items: customerOrderCart.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
        })),
      })
      setCustomerOrderCart([])
      setCustomerOrderRef({
        orderId: order.order_id,
        orderNumber: order.order_number,
      })
      setNotice(
        `Order ${order.order_number} placed. Waiting for manager verification before kitchen dispatch.`,
      )
      const snapshot = await getCustomerOrderStatus(token, order.order_id)
      setCustomerOrderStatus(snapshot)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleAdvanceTicket = async (ticket) => {
    if (!token) {
      return
    }

    const nextStatusByCurrent = {
      TO_COOK: 'PREPARING',
      PREPARING: 'COMPLETED',
    }
    const nextStatus = nextStatusByCurrent[ticket.ticket_status]
    if (!nextStatus) {
      return
    }

    setIsBusy(true)
    setError('')
    try {
      await updateKitchenTicketStatus(token, ticket.ticket_id, nextStatus)
      refreshKitchenTickets()
      refreshCustomerDisplay()
      refreshPendingVerificationOrders()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleAdvanceTicketPublic = async (ticket) => {
    const nextStatusByCurrent = {
      TO_COOK: 'PREPARING',
      PREPARING: 'COMPLETED',
    }
    const nextStatus = nextStatusByCurrent[ticket.ticket_status]
    if (!nextStatus) {
      return
    }

    setIsBusy(true)
    setError('')
    try {
      await updatePublicKitchenTicketStatus(kitchenAccessKey, ticket.ticket_id, nextStatus)
      refreshPublicKitchenTickets()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleVerifyAndSendOrder = async (order) => {
    if (!token) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      const ticket = await sendOrderToKitchen(token, order.order_id)
      setLastTicket(ticket)
      setPendingPaymentOrder({
        orderId: order.order_id,
        orderNumber: order.order_number,
        amount: order.total_amount,
      })
      setCustomerTableId(order.table_id)
      setUpiQr(null)
      setPaymentConfirmation(null)
      refreshPendingVerificationOrders()
      refreshKitchenTickets()
      refreshCustomerDisplay()
      setNotice(`Order ${order.order_number} verified and sent to kitchen.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleRejectPendingOrder = async (order) => {
    if (!token) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await rejectPendingOrder(token, order.order_id, {
        reason: 'Rejected by manager during verification.',
      })
      refreshPendingVerificationOrders()
      refreshCustomerDisplay()
      setNotice(`Order ${order.order_number} rejected.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleTogglePaymentMethod = async (method) => {
    if (!token) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await updatePaymentMethod(token, method.id, {
        is_enabled: !method.is_enabled,
      })
      await refreshMasterData()
      setNotice(`${method.name} ${method.is_enabled ? 'disabled' : 'enabled'}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleUpdateUpiId = async (method) => {
    if (!token || method.method_type !== 'UPI') {
      return
    }

    const nextUpiId = window.prompt('Enter UPI ID', method.upi_id || '')?.trim()
    if (nextUpiId === undefined) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await updatePaymentMethod(token, method.id, {
        upi_id: nextUpiId,
      })
      await refreshMasterData()
      setNotice('UPI ID updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleCreateFloor = async () => {
    if (!token || !newFloorName.trim()) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await createFloor(token, { name: newFloorName.trim() })
      setNewFloorName('')
      await refreshMasterData()
      setNotice('Floor created successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleCreateTable = async () => {
    if (!token || !newTableForm.floorId || !newTableForm.tableNumber.trim()) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await createTable(token, {
        floor_id: Number(newTableForm.floorId),
        table_number: newTableForm.tableNumber.trim(),
        seats: Number(newTableForm.seats || '2'),
      })
      setNewTableForm({ floorId: '', tableNumber: '', seats: '2' })
      await refreshMasterData()
      setNotice('Table created successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleToggleTableActive = async (table) => {
    if (!token) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await updateTable(token, table.id, {
        is_active: !table.is_active,
      })
      await refreshMasterData()
      setNotice(
        `Table ${table.table_number} ${table.is_active ? 'deactivated' : 'activated'}.`,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!token || !newProductForm.name.trim() || !newProductForm.price) {
      return
    }

    setError('')
    setNotice('')
    setIsBusy(true)
    try {
      await createProduct(token, {
        name: newProductForm.name.trim(),
        category: newProductForm.category.trim(),
        price: Number(newProductForm.price),
        unit: newProductForm.unit.trim() || 'unit',
        tax_rate: Number(newProductForm.taxRate || '0'),
        description: newProductForm.description.trim(),
      })
      setNewProductForm({
        name: '',
        category: '',
        price: '',
        unit: 'plate',
        taxRate: '5',
        description: '',
      })
      await refreshMasterData()
      setNotice('Product created successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsBusy(false)
    }
  }

  if ((!token || !user) && !isKitchenDisplayMode) {
    if (!authRoleChoice) {
      return (
        <main className="auth-shell">
          <section className="auth-card">
            <p className="eyebrow">Odoo POS Cafe</p>
            <h1>Choose Sign-in Type</h1>
            <p className="auth-subtitle">
              Continue as a customer for self-ordering, or as a manager for terminal operations.
            </p>
            <div className="role-choice-grid">
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setAuthRoleChoice('customer')
                  setMode('login')
                  setError('')
                }}
              >
                Sign in as Customer
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setAuthRoleChoice('manager')
                  setMode('login')
                  setError('')
                }}
              >
                Sign in as Manager
              </button>
            </div>
          </section>
        </main>
      )
    }

    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Odoo POS Cafe</p>
          <h1>
            {authRoleChoice === 'customer'
              ? 'Customer Self-Order Sign in'
              : 'Manager Terminal Sign in'}
          </h1>
          <p className="auth-subtitle">
            {authRoleChoice === 'customer'
              ? 'Sign in to place self-orders and follow your order status.'
              : 'Sign in to open your register and start table-based ordering.'}
          </p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="staff@odoo.cafe"
                required
              />
            </label>

            {mode === 'signup' && (
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  type="text"
                  placeholder="barista"
                  required
                />
              </label>
            )}

            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={6}
                required
              />
            </label>

            <button disabled={isBusy} type="submit" className="button-primary">
              {isBusy ? 'Working...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <button
            className="button-ghost"
            type="button"
            onClick={() => setMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
          </button>

          <button
            className="button-ghost"
            type="button"
            onClick={() => {
              setAuthRoleChoice(null)
              setMode('login')
              setError('')
            }}
          >
            Change Sign-in Type
          </button>

          {error && <p className="error-banner">{error}</p>}
        </section>
      </main>
    )
  }

  if (isCustomerUser) {
    return (
      <main className="pos-page customer-page" aria-busy={isBusy}>
        <header className="top-bar">
          <div>
            <p className="eyebrow">Customer Portal</p>
            <h1>Self Order</h1>
            <p className="session-label">
              {user.username} · {session ? `Session #${session.session_id} open` : 'Register closed'}
            </p>
          </div>
          <div className="top-bar-actions">
            <button type="button" className="button-secondary" onClick={handleReloadData}>
              Reload Data
            </button>
            <button type="button" className="button-secondary button-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {error && <p className="error-banner" role="alert">{error}</p>}
        {notice && <p className="notice-banner" role="status">{notice}</p>}

        <section className="floor-panel">
          <h2>Choose Table</h2>
          <div className="chip-row">
            {allTables.map((table) => (
              <button
                key={table.id}
                type="button"
                className={customerTableIdSelfOrder === table.id ? 'chip chip-active' : 'chip'}
                onClick={() => setCustomerTableIdSelfOrder(table.id)}
                disabled={!table.is_active}
              >
                {table.table_number}
              </button>
            ))}
          </div>
        </section>

        <section className="main-grid">
          <div className="product-panel">
            <h2>Menu</h2>
            <div className="product-grid">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="product-card"
                  onClick={() => addProductToCustomerCart(product)}
                >
                  <p className="product-name">{product.name}</p>
                  <p className="product-meta">{product.category}</p>
                  <p className="product-price">{formatMoney(product.price)}</p>
                </button>
              ))}
            </div>
          </div>

          <aside className="order-tray">
            <h2>Your Order</h2>
            <p className="table-pill">
              {customerSelectedTable
                ? `Table ${customerSelectedTable.table_number}`
                : 'No table selected'}
            </p>

            <div className="order-lines">
              {customerOrderCart.length === 0 && <p className="empty-note">No items selected.</p>}
              {customerOrderCart.map((line) => (
                <article key={line.productId} className="order-line-card">
                  <p>{line.name}</p>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => updateCustomerCartQuantity(line.productId, line.quantity - 1)}
                    >
                      -
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => updateCustomerCartQuantity(line.productId, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="totals-block">
              <p>Subtotal: {formatMoney(customerCartSummary.subtotal)}</p>
              <p>Tax: {formatMoney(customerCartSummary.tax)}</p>
              <p className="total-row">Total: {formatMoney(customerCartSummary.total)}</p>
            </div>

            <button
              className="button-primary"
              type="button"
              onClick={handlePlaceCustomerOrder}
              disabled={isBusy || customerOrderCart.length === 0 || !session || !customerSelectedTable}
            >
              Place Order
            </button>
          </aside>
        </section>

        <section className="customer-display-board">
          <div className="customer-display-header">
            <h2>Order Status</h2>
          </div>

          {!customerOrderStatus?.available && (
            <p className="empty-note">Place an order to track its status.</p>
          )}

          {customerOrderStatus?.available && customerOrderStatus?.order && (
            <article className="customer-display-card">
              <p className="customer-order-title">
                {customerOrderStatus.order.order_number} · Table {customerOrderStatus.order.table_number || '-'}
              </p>
              <div className="customer-status-row">
                <span className="customer-status-pill">
                  Order: {customerOrderStatus.order.order_status}
                </span>
                <span className="customer-status-pill">
                  Kitchen: {customerOrderStatus.order.kitchen_status}
                </span>
                <span className="customer-status-pill customer-status-pill-payment">
                  Payment: {customerOrderStatus.order.payment_status}
                </span>
              </div>

              {customerOrderStatus.order.order_status === 'REJECTED' && (
                <p className="error-banner">
                  This order was rejected by manager. Please place a new order.
                </p>
              )}

              <div className="customer-item-list">
                {customerOrderStatus.order.items.map((item, index) => (
                  <p key={`${customerOrderStatus.order.order_id}-${item.product_name}-${index}`}>
                    {item.quantity} x {item.product_name}
                  </p>
                ))}
              </div>

              <p className="customer-total-row">
                Total: {formatMoney(customerOrderStatus.order.total_amount)}
              </p>
            </article>
          )}
        </section>
      </main>
    )
  }

  if (isKitchenDisplayMode) {
    return (
      <main className="pos-page kitchen-page" aria-busy={isBusy}>
        <header className="top-bar">
          <div>
            <p className="eyebrow">Kitchen Display</p>
            <h1>Odoo POS Cafe Kitchen</h1>
            <p className="session-label">{user?.username || 'Public Kitchen Screen'}</p>
          </div>
          <div className="top-bar-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={isKitchenPublicMode ? refreshPublicKitchenTickets : refreshKitchenTickets}
            >
              Refresh
            </button>
            {!isKitchenPublicMode && (
              <button type="button" className="button-secondary button-danger" onClick={handleLogout}>
                Logout
              </button>
            )}
          </div>
        </header>

        {error && <p className="error-banner" role="alert">{error}</p>}
        {notice && <p className="notice-banner" role="status">{notice}</p>}

        <section className="kitchen-board">
          <div className="kitchen-board-header">
            <h2>Kitchen Display</h2>
            <div className="chip-row">
              <button
                type="button"
                className={kitchenFilter === '' ? 'chip chip-active' : 'chip'}
                onClick={() => setKitchenFilter('')}
              >
                All
              </button>
              <button
                type="button"
                className={kitchenFilter === 'TO_COOK' ? 'chip chip-active' : 'chip'}
                onClick={() => setKitchenFilter('TO_COOK')}
              >
                To Cook
              </button>
              <button
                type="button"
                className={kitchenFilter === 'PREPARING' ? 'chip chip-active' : 'chip'}
                onClick={() => setKitchenFilter('PREPARING')}
              >
                Preparing
              </button>
              <button
                type="button"
                className={kitchenFilter === 'COMPLETED' ? 'chip chip-active' : 'chip'}
                onClick={() => setKitchenFilter('COMPLETED')}
              >
                Completed
              </button>
            </div>
          </div>

          <div className="kitchen-kanban">
            {(kitchenFilter
              ? kitchenBoardColumns.filter((column) => column.key === kitchenFilter)
              : kitchenBoardColumns
            ).map((column) => (
              <section key={column.key} className="kitchen-column">
                <header className="kitchen-column-header">
                  <h3>{column.label}</h3>
                  <span className="kitchen-column-count">{column.tickets.length}</span>
                </header>

                {column.tickets.length === 0 && (
                  <p className="empty-note">No tickets in this stage.</p>
                )}

                <div className="kitchen-grid">
                  {column.tickets.map((ticket) => (
                    <article key={ticket.ticket_id} className="kitchen-ticket-card">
                      <p className="kitchen-ticket-title">
                        {ticket.order_number} · Table {ticket.table_number || '-'}
                      </p>
                      <p className="kitchen-ticket-status">{ticket.ticket_status}</p>
                      <div className="kitchen-item-list">
                        {ticket.items.map((item, index) => (
                          <p key={`${ticket.ticket_id}-${item.product_name}-${index}`}>
                            {item.quantity} x {item.product_name}
                          </p>
                        ))}
                      </div>
                      {ticket.ticket_status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() =>
                            isKitchenPublicMode
                              ? handleAdvanceTicketPublic(ticket)
                              : handleAdvanceTicket(ticket)
                          }
                          disabled={isBusy}
                        >
                          Move to {ticket.ticket_status === 'TO_COOK' ? 'Preparing' : 'Completed'}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="pos-page manager-page" aria-busy={isBusy}>
      <header className="top-bar">
        <div>
          <p className="eyebrow">Session Operator</p>
          <h1>Odoo POS Cafe</h1>
          <p className="session-label">
            {user.username} · {session ? `Session #${session.session_id} open` : 'Register closed'}
          </p>
        </div>
        <div className="top-bar-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handleReloadData}
            disabled={isBusy}
          >
            Reload Data
          </button>
          <button
            type="button"
            className={view === 'pos' ? 'chip chip-active' : 'chip'}
            onClick={() => setView('pos')}
          >
            Register
          </button>
          <button
            type="button"
            className={view === 'customer' ? 'chip chip-active' : 'chip'}
            onClick={() => setView('customer')}
          >
            Customer
          </button>
          <button
            type="button"
            className={view === 'backend' ? 'chip chip-active' : 'chip'}
            onClick={() => setView('backend')}
          >
            Back-end
          </button>
          <button
            type="button"
            className={view === 'reports' ? 'chip chip-active' : 'chip'}
            onClick={() => setView('reports')}
          >
            Reports
          </button>
          {!session && (
            <button
              type="button"
              className="button-primary"
              onClick={handleOpenSession}
              disabled={isBusy}
            >
              Open Session
            </button>
          )}
          {session && (
            <button
              type="button"
              className="button-secondary"
              onClick={handleCloseRegister}
              disabled={isBusy}
            >
              Close Register
            </button>
          )}
          <button type="button" className="button-secondary button-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {error && <p className="error-banner" role="alert">{error}</p>}
      {notice && <p className="notice-banner" role="status">{notice}</p>}

      {view === 'customer' && (
        <section className="customer-display-board">
          <div className="customer-display-header">
            <h2>Customer Display</h2>
            <div className="chip-row">
              <button
                type="button"
                className={customerTableId === null ? 'chip chip-active' : 'chip'}
                onClick={() => setCustomerTableId(null)}
              >
                Latest
              </button>
              {allTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className={customerTableId === table.id ? 'chip chip-active' : 'chip'}
                  onClick={() => setCustomerTableId(table.id)}
                >
                  {table.table_number}
                </button>
              ))}
              <button
                type="button"
                className="button-secondary"
                onClick={refreshCustomerDisplay}
              >
                Refresh
              </button>
            </div>
          </div>

          {!customerDisplay?.available && (
            <p className="empty-note">No order available for customer display yet.</p>
          )}

          {customerDisplay?.available && customerDisplay?.order && (
            <article className="customer-display-card">
              <p className="customer-order-title">
                {customerDisplay.order.order_number} · Table {customerDisplay.order.table_number || '-'}
              </p>
              <div className="customer-status-row">
                <span className="customer-status-pill">
                  Kitchen: {customerDisplay.order.kitchen_status}
                </span>
                <span className="customer-status-pill customer-status-pill-payment">
                  Payment: {customerDisplay.order.payment_status}
                </span>
              </div>

              <div className="customer-item-list">
                {customerDisplay.order.items.map((item, index) => (
                  <p key={`${customerDisplay.order.order_id}-${item.product_name}-${index}`}>
                    {item.quantity} x {item.product_name}
                  </p>
                ))}
              </div>

              <p className="customer-total-row">
                Total: {formatMoney(customerDisplay.order.total_amount)}
              </p>
            </article>
          )}
        </section>
      )}

      {view === 'reports' && (
        <section className="reports-board">
          <div className="reports-header">
            <h2>Sales Dashboard</h2>
            <div className="reports-filter-grid">
              <label>
                Period
                <select
                  value={reportFilters.period}
                  onChange={(event) =>
                    setReportFilters((prev) => ({ ...prev, period: event.target.value }))
                  }
                >
                  <option value="all">All</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>

              <label>
                From Date
                <input
                  type="date"
                  value={reportFilters.fromDate}
                  onChange={(event) =>
                    setReportFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                  }
                />
              </label>

              <label>
                To Date
                <input
                  type="date"
                  value={reportFilters.toDate}
                  onChange={(event) =>
                    setReportFilters((prev) => ({ ...prev, toDate: event.target.value }))
                  }
                />
              </label>

              <label>
                Session Id
                <input
                  value={reportFilters.sessionId}
                  onChange={(event) =>
                    setReportFilters((prev) => ({ ...prev, sessionId: event.target.value }))
                  }
                  placeholder="optional"
                />
              </label>

              <label>
                Responsible Id
                <input
                  value={reportFilters.responsibleId}
                  onChange={(event) =>
                    setReportFilters((prev) => ({
                      ...prev,
                      responsibleId: event.target.value,
                    }))
                  }
                  placeholder="optional"
                />
              </label>

              <label>
                Product Id
                <input
                  value={reportFilters.productId}
                  onChange={(event) =>
                    setReportFilters((prev) => ({ ...prev, productId: event.target.value }))
                  }
                  placeholder="optional"
                />
              </label>

              <button type="button" className="button-secondary" onClick={refreshSalesReport}>
                Refresh
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={isExporting}
                onClick={() => handleExportReport('csv')}
              >
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={isExporting}
                onClick={() => handleExportReport('xlsx')}
              >
                {isExporting ? 'Exporting...' : 'Export XLSX'}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={isExporting}
                onClick={() => handleExportReport('pdf')}
              >
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>

            <div className="reports-presets-row">
              <label>
                Preset
                <select
                  value={selectedPresetName}
                  onChange={(event) => setSelectedPresetName(event.target.value)}
                >
                  <option value="">Select preset</option>
                  {reportPresets.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button-secondary"
                onClick={handleApplyReportPreset}
                disabled={!selectedPresetName}
              >
                Apply Preset
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleSaveReportPreset}
              >
                Save Preset
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleDeleteReportPreset}
                disabled={!selectedPresetName}
              >
                Delete Preset
              </button>
            </div>
          </div>

          <div className="reports-kpi-grid">
            <article className="reports-kpi-card">
              <p>Total Sales</p>
              <h3>{formatMoney(salesReport?.summary?.total_sales || 0)}</h3>
            </article>
            <article className="reports-kpi-card">
              <p>Orders</p>
              <h3>{salesReport?.summary?.order_count || 0}</h3>
            </article>
            <article className="reports-kpi-card">
              <p>Average Order</p>
              <h3>{formatMoney(salesReport?.summary?.avg_order_value || 0)}</h3>
            </article>
          </div>

          <div className="reports-split-grid">
            <article className="reports-card">
              <h3>Top Products</h3>
              {!salesReport?.by_product?.length && (
                <p className="empty-note">No product sales for selected filters.</p>
              )}
              {salesReport?.by_product?.map((row) => (
                <p key={row.product_id} className="reports-row">
                  {row.product_name} · {row.quantity_sold} sold · {formatMoney(row.revenue)}
                </p>
              ))}
            </article>

            <article className="reports-card">
              <h3>Payment Mix</h3>
              {!salesReport?.by_payment_method?.length && (
                <p className="empty-note">No payment data for selected filters.</p>
              )}
              {salesReport?.by_payment_method?.map((row, index) => (
                <p key={`${row.method_type}-${index}`} className="reports-row">
                  {row.name} ({row.transactions}) · {formatMoney(row.total)}
                </p>
              ))}
            </article>
          </div>
        </section>
      )}

      {view === 'backend' && (
        <section className="reports-board">
          <div className="reports-header">
            <h2>Back-end Configuration</h2>
          </div>

          <div className="reports-split-grid">
            <article className="reports-card">
              <h3>Payment Methods</h3>
              {paymentMethods.map((method) => (
                <div key={method.id} className="reports-presets-row">
                  <p className="reports-row">
                    {method.name} ({method.method_type}) · {method.is_enabled ? 'Enabled' : 'Disabled'}
                    {method.method_type === 'UPI' ? ` · ${method.upi_id || 'UPI ID not set'}` : ''}
                  </p>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={isBusy}
                    onClick={() => handleTogglePaymentMethod(method)}
                  >
                    {method.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  {method.method_type === 'UPI' && (
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={isBusy}
                      onClick={() => handleUpdateUpiId(method)}
                    >
                      Edit UPI ID
                    </button>
                  )}
                </div>
              ))}
            </article>

            <article className="reports-card">
              <h3>Floor & Tables</h3>
              <div className="reports-filter-grid">
                <label>
                  New Floor Name
                  <input
                    value={newFloorName}
                    onChange={(event) => setNewFloorName(event.target.value)}
                    placeholder="Ground Floor"
                  />
                </label>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={isBusy || !newFloorName.trim()}
                  onClick={handleCreateFloor}
                >
                  Create Floor
                </button>
              </div>

              <div className="reports-filter-grid">
                <label>
                  Floor
                  <select
                    value={newTableForm.floorId}
                    onChange={(event) =>
                      setNewTableForm((prev) => ({ ...prev, floorId: event.target.value }))
                    }
                  >
                    <option value="">Select floor</option>
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Table Number
                  <input
                    value={newTableForm.tableNumber}
                    onChange={(event) =>
                      setNewTableForm((prev) => ({
                        ...prev,
                        tableNumber: event.target.value,
                      }))
                    }
                    placeholder="T-12"
                  />
                </label>
                <label>
                  Seats
                  <input
                    type="number"
                    min="1"
                    value={newTableForm.seats}
                    onChange={(event) =>
                      setNewTableForm((prev) => ({ ...prev, seats: event.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={
                    isBusy || !newTableForm.floorId || !newTableForm.tableNumber.trim()
                  }
                  onClick={handleCreateTable}
                >
                  Create Table
                </button>
              </div>

              {floors.map((floor) => (
                <div key={floor.id} className="reports-presets-row">
                  <p className="reports-row">{floor.name}</p>
                  {floor.tables.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      className={table.is_active ? 'chip chip-active' : 'chip'}
                      onClick={() => handleToggleTableActive(table)}
                      disabled={isBusy}
                    >
                      {table.table_number} ({table.seats})
                    </button>
                  ))}
                </div>
              ))}
            </article>
          </div>

          <article className="reports-card">
            <h3>Create Product</h3>
            <div className="reports-filter-grid">
              <label>
                Name
                <input
                  value={newProductForm.name}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Espresso"
                />
              </label>
              <label>
                Category
                <input
                  value={newProductForm.category}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder="Beverages"
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProductForm.price}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </label>
              <label>
                Unit
                <input
                  value={newProductForm.unit}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({ ...prev, unit: event.target.value }))
                  }
                  placeholder="plate"
                />
              </label>
              <label>
                Tax Rate %
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProductForm.taxRate}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({ ...prev, taxRate: event.target.value }))
                  }
                />
              </label>
              <label>
                Description
                <input
                  value={newProductForm.description}
                  onChange={(event) =>
                    setNewProductForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <button
                type="button"
                className="button-secondary"
                disabled={isBusy || !newProductForm.name.trim() || !newProductForm.price}
                onClick={handleCreateProduct}
              >
                Create Product
              </button>
            </div>
          </article>
        </section>
      )}

      {view === 'pos' && (
        <>

      <section className="verification-panel">
        <div className="verification-panel-header">
          <h2>Customer Orders Pending Verification</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={refreshPendingVerificationOrders}
            disabled={isBusy}
          >
            Refresh Queue
          </button>
        </div>

        {pendingVerificationOrders.length === 0 && (
          <p className="empty-note">No customer orders waiting for manager verification.</p>
        )}

        <div className="verification-grid">
          {pendingVerificationOrders.map((order) => (
            <article key={order.order_id} className="verification-card">
              <p className="verification-title">
                {order.order_number} · Table {order.table_number}
              </p>
              <p className="verification-meta">Customer: {formatOrderCustomer(order)}</p>
              <p className="verification-meta">Total: {formatMoney(order.total_amount)}</p>
              <div className="verification-items">
                {order.items.map((item, index) => (
                  <p key={`${order.order_id}-${item.product_name}-${index}`}>
                    {item.quantity} x {item.product_name}
                  </p>
                ))}
              </div>
              <div className="verification-actions">
                <button
                  type="button"
                  className="button-primary"
                  disabled={isBusy || !session}
                  onClick={() => handleVerifyAndSendOrder(order)}
                >
                  Send to Kitchen
                </button>
                <button
                  type="button"
                  className="button-ghost button-danger-ghost"
                  disabled={isBusy}
                  onClick={() => handleRejectPendingOrder(order)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="floor-panel">
        <h2>Floor View</h2>
        <div className="chip-row">
          {floors.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className={floor.id === selectedFloorId ? 'chip chip-active' : 'chip'}
              onClick={() => setSelectedFloorId(floor.id)}
            >
              {floor.name}
            </button>
          ))}
        </div>
        <div className="table-grid">
          {selectedFloor?.tables?.map((table) => (
            <button
              key={table.id}
              type="button"
              className={selectedTable?.id === table.id ? 'table-card table-selected' : 'table-card'}
              onClick={() => setSelectedTable(table)}
              disabled={!table.is_active}
            >
              <p>{table.table_number}</p>
              <span>{table.seats} seats</span>
            </button>
          ))}
        </div>
      </section>

      <section className="main-grid">
        <div className="product-panel">
          <h2>Artisan Menu</h2>
          <div className="product-grid">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                className="product-card"
                onClick={() => addProductToOrder(product)}
              >
                <p className="product-name">{product.name}</p>
                <p className="product-meta">{product.category}</p>
                <p className="product-price">{formatMoney(product.price)}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="order-tray">
          <h2>Order Tray</h2>
          <p className="table-pill">
            {selectedTable ? `Table ${selectedTable.table_number}` : 'No table selected'}
          </p>

          <div className="order-lines">
            {orderLines.length === 0 && <p className="empty-note">No items yet.</p>}
            {orderLines.map((line) => (
              <article key={line.productId} className="order-line-card">
                <p>{line.name}</p>
                <div className="quantity-controls">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => updateLineQuantity(line.productId, line.quantity - 1)}
                  >
                    -
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => updateLineQuantity(line.productId, line.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="totals-block">
            <p>Subtotal: {formatMoney(orderSummary.subtotal)}</p>
            <p>Tax: {formatMoney(orderSummary.tax)}</p>
            <p className="total-row">Total: {formatMoney(orderSummary.total)}</p>
          </div>

          <button
            className="button-primary"
            type="button"
            onClick={handleSendToKitchen}
            disabled={isBusy || orderLines.length === 0 || !session || !selectedTable}
          >
            Send to Kitchen
          </button>

          {lastTicket && (
            <div className="ticket-notice">
              <p>Ticket #{lastTicket.ticket_id}</p>
              <p>{lastTicket.order_number} moved to kitchen queue.</p>
            </div>
          )}

          {pendingPaymentOrder && (
            <section className="payment-block">
              <h3>Payment</h3>
              <p className="payment-order-label">
                {pendingPaymentOrder.orderNumber} · {formatMoney(pendingPaymentOrder.amount)}
              </p>

              <div className="chip-row payment-chip-row">
                {enabledPaymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={
                      method.id === selectedPaymentMethodId ? 'chip chip-active' : 'chip'
                    }
                    onClick={() => {
                      setSelectedPaymentMethodId(method.id)
                      setUpiQr(null)
                    }}
                  >
                    {method.name}
                  </button>
                ))}
              </div>

              {selectedPaymentMethod?.method_type === 'UPI' && (
                <>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={handleGenerateUpiQr}
                    disabled={isBusy}
                  >
                    Generate UPI QR
                  </button>

                  {upiQr?.qr_image_data_url && (
                    <div className="upi-qr-card">
                      <img
                        src={upiQr.qr_image_data_url}
                        alt="UPI QR"
                        width="180"
                        height="180"
                      />
                      <p>Amount: {formatMoney(upiQr.amount)}</p>
                    </div>
                  )}
                </>
              )}

              <button
                className="button-primary"
                type="button"
                onClick={handleConfirmPayment}
                disabled={isBusy}
              >
                Confirm Payment
              </button>
            </section>
          )}

          {paymentConfirmation && (
            <div className="payment-success-card">
              <p>{paymentConfirmation.order_number} paid successfully.</p>
              <p>
                {paymentConfirmation.payment.payment_method} ·{' '}
                {formatMoney(paymentConfirmation.payment.amount)}
              </p>
            </div>
          )}
        </aside>
      </section>
        </>
      )}
    </main>
  )
}

export default App
