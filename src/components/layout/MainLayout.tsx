import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import AdSenseSidebar from "./AdSenseSidebar";

const MainLayout = () => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <div className="flex flex-1">
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <AdSenseSidebar />
    </div>
    <Footer />
  </div>
);

export default MainLayout;
