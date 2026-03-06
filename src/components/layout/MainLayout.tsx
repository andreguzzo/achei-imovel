import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import AdSenseBar from "./AdSenseSidebar";

const MainLayout = () => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <AdSenseBar />
    <Footer />
  </div>
);

export default MainLayout;
