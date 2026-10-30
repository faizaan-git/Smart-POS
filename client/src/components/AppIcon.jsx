import {
  FaBell,
  FaBox,
  FaBuilding,
  FaCalendarAlt,
  FaCamera,
  FaChartBar,
  FaChartLine,
  FaCheck,
  FaClock,
  FaCog,
  FaCreditCard,
  FaDesktop,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaFilePdf,
  FaFilter,
  FaInbox,
  FaKey,
  FaMobileAlt,
  FaMoneyBillWave,
  FaMoon,
  FaPalette,
  FaPrint,
  FaReceipt,
  FaSave,
  FaSearch,
  FaShieldAlt,
  FaShoppingCart,
  FaSignOutAlt,
  FaStore,
  FaSun,
  FaUser,
  FaUserTie,
  FaUsers,
} from "react-icons/fa";

const icons = {
  bell: FaBell,
  box: FaBox,
  building: FaBuilding,
  calendar: FaCalendarAlt,
  camera: FaCamera,
  chart: FaChartBar,
  chartLine: FaChartLine,
  check: FaCheck,
  clock: FaClock,
  settings: FaCog,
  creditCard: FaCreditCard,
  desktop: FaDesktop,
  warning: FaExclamationTriangle,
  invoice: FaFileInvoiceDollar,
  pdf: FaFilePdf,
  filter: FaFilter,
  inbox: FaInbox,
  key: FaKey,
  mobile: FaMobileAlt,
  money: FaMoneyBillWave,
  moon: FaMoon,
  palette: FaPalette,
  print: FaPrint,
  receipt: FaReceipt,
  save: FaSave,
  search: FaSearch,
  shield: FaShieldAlt,
  cart: FaShoppingCart,
  logout: FaSignOutAlt,
  store: FaStore,
  sun: FaSun,
  user: FaUser,
  manager: FaUserTie,
  users: FaUsers,
};

function AppIcon({ name, ...props }) {
  const IconComponent = icons[name];

  if (!IconComponent) {
    return null;
  }

  return <IconComponent aria-hidden="true" focusable="false" {...props} />;
}

export default AppIcon;
