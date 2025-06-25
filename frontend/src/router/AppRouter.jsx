import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import RootLayout from "../layout/Layout";
import NotFound from "../utils/NotFound";
import Dashboard from "../component/welcome/Dashboard";
import Setting from "../component/welcome/setting/Setting";
import Login from "../component/welcome/login/Login";
import Profile from "../component/welcome/proflie/Profile";
import Users from "../component/users/Users";
import UserDetails from "../component/users/userDetails/UserDetails";
import UserLayout from "@/component/users/UserLayout";
import Permission from "@/component/users/permission/Permission";
import Roles from "@/component/users/roles/Roles";
import Activities from "@/component/activities/Activities";
import EditUserModal from "@/component/users/EditUserModal";
import ProtectedRoute from "./ProtectedRoute.jsx"; // Import the ProtectedRoute componentimpo
import ContestCreate from "@/component/admin/contest/Create";
import ViewContest from "@/component/admin/contest/ViewContest";
import OptionChart from "@/component/admin/option/OptionChart";
import ActiveContest from "@/component/admin/contest/ActiveContest";
import Wallet from "@/component/admin/wallet/Wallet";
import MyContest from "@/component/admin/contest/MyContest";
import OptionDetails from "@/component/admin/option/OptionDetails";
import HistoryChart from "@/component/admin/option/HistoryChart";
import Positions from "@/component/admin/positions/Positions";
import StockverseLogin from "../component/welcome/login/Login";
import Leaderboard from "@/component/admin/option/components/leaderboard/Leaderboard";
import Withdrawals from "@/component/admin/withdrawals/Withdrawals";
import Deposit from "@/component/admin/deposit/Deposit";
import WithDraw from "@/component/admin/withdrawals/WithDraw";
import Price from "@/component/admin/price/Price";
import ContestPrizeDistribution from "@/component/admin/price/Price";

// import Activities from "@/component/activities/Activities";

export const createAppRouter = (isAuthenticated) =>
  createBrowserRouter([
    {
      path: "/",
      element: isAuthenticated ? <RootLayout /> : <Navigate to="/login" />,
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: "users",
          element: (
            <ProtectedRoute requiredPermissions={["read-users"]}>
              <UserLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              path: "",
              element: <Users />,
            },
            {
              path: ":id",
              element: <UserDetails />,
            },
            {
              path: "edit/:id",
              element: <EditUserModal />,
            },
          ],
        },
        {
          path: "permissions/:id",
          element: (
            <ProtectedRoute requiredPermissions={["manage-permissions"]}>
              <Permission />
            </ProtectedRoute>
          ),
        },

        {
          path: "roles",
          element: (
            <ProtectedRoute requiredPermissions={["manage-roles"]}>
              <Roles />
            </ProtectedRoute>
          ),
        },
        {
          path: "activities", // New Route
          element: (
            <ProtectedRoute requiredPermissions={["read-activities"]}>
              <Activities />
            </ProtectedRoute>
          ),
        },
        {
          path: "settings",
          element: (
            <ProtectedRoute requiredPermissions={["general-settings"]}>
              <Setting />
            </ProtectedRoute>
          ),
        },
        {
          path: "withdrawals",
          element: (
            <ProtectedRoute requiredPermissions={["request-withdrawal"]}>
              <Withdrawals />
            </ProtectedRoute>
          ),
        },
        {
          path: "profile",
          element: <Profile />,
        },
        {
          path: "admin/deposits",
          element: (
            <ProtectedRoute requiredPermissions={["manage-deposits"]}>
              <Deposit />
            </ProtectedRoute>
          ),
        },
        {
          path: "admin/withdrawals",
          element: (
            <ProtectedRoute requiredPermissions={["manage-withdrawals"]}>
              <WithDraw />
            </ProtectedRoute>
          ),
        },
        {
          path: "admin/price",
          element: (
            <ProtectedRoute requiredPermissions={["manage-price"]}>
              <ContestPrizeDistribution />
            </ProtectedRoute>
          ),
        },
        {
          path: "contests",
          element: <ActiveContest />,
        },
        {
          path: "wallet",
          element: <Wallet />,
        },
        {
          path: "my-contests",
          element: <MyContest />,
        },

        {
          path: "*",
          element: <NotFound />,
        },
        {
          path: "option-chain/:id",
          element: <OptionChart />,
        },
        {
          path: "option-details/:id/:optionId",
          element: <HistoryChart />,
        },
        {
          path: "leaderboard",
          element: <Leaderboard />,
        },
        {
          path: "positions",
          element: <Positions />,
        },
        {
          path: "admin",
          element: <Outlet />,
          children: [
            {
              path: "contests/create",
              element: <ContestCreate />,
            },
            {
              path: "contests/:id",
              element: <ViewContest />,
            },
          ],
        },
      ],
    },
    {
      path: "/login",
      element: !isAuthenticated ? <StockverseLogin /> : <Navigate to="/" />,
    },
  ]);
