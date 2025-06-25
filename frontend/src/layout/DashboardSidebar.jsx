"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle, ScissorsSquareIcon, TrendingUp, TrophyIcon } from "lucide-react";
import {
  // Overview Icons
  LayoutDashboard, // Dashboard icon

  // Management Icons
  Users, // Accounts icon
  User, // User Management icon
  Settings, // Settings icon
  LineChart, // Option Chain icon
  Briefcase, // My Positions icon
  History, // Trade History icon
  Trophy, // Active Contests icon
  Target, // My Contests icon
  Medal, // Leaderboard icon
  Wallet, // Wallet icon
  PiggyBank, // Withdrawal Requests icon
  Gamepad, // Contest Management iconkl
  PlusCircle, // Create Contest icon
  Settings2, // Manage Contests icon
  Users2, // All Users icon
  UserCog, // User Roles icon
  ArrowDownToLine, // Deposits icon
  ArrowUpFromLine, // Withdrawals icon
  Wrench, // General Settings icon
  Bell, // Announcements icon
  FileText, // Reports icon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import logo from "../assets/logo1.png";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/hooks/color-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSelector } from "react-redux";
import { createSelector } from "reselect";

const submenuLineStyles = `
  relative before:absolute before:left-[11px] before:top-0 before:h-full before:w-px before:bg-gray-200
  [&>li:last-child]:before:h-[1.1rem]
`;

const navigation = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        url: "/",
        permission: "read-dashboard",
      },
    ],
  },
  {
    title: "Trading",
    items: [
      // {
      //   title: "Option Chain",
      //   icon: LineChart,
      //   url: "/option-chain",
      //   permission: "access-trading",
      // },
      {
        title: "My Positions",
        icon: Briefcase,
        url: "/positions",
        permission: "view-positions",
      },

      {
        title:"Leader Board",
        icon:Bell,
        url:"/leaderboard",
        permission:"view-rank"
      },
      {
        title: "Trade History",
        icon: History,
        url: "/trade-history",
        permission: "view-trades",
      }
    ],
  },
  {
    title: "Contests",
    items: [
      {
        title: "Active Contests",
        icon: Trophy,
        url: "/contests",
        permission: "view-contests",
      },
      {
        title: "My Contests",
        icon: Target,
        url: "/my-contests",
        permission: "view-my-contests",
      },
      {
        title: "Leaderboard",
        icon: Medal,
        url: "/leaderboard",
        permission: "view-leaderboard",
      },
    ],
  },
  {
    title: "Wallet",
    items: [
      {
        title: "Balance & History",
        icon: Wallet,
        url: "/wallet",
        permission: "access-wallet",
      },
      {
        title: "Withdrawal Requests",
        icon: PiggyBank,
        url: "/withdrawals",
        permission: "request-withdrawal",
      }
    ],
  },
  // Admin-only section
  {
    title: "Administration",
    adminOnly: true,
    items: [
      {
        title: "Contest Management",
        icon: Gamepad,
        children: [
          {
            title: "Create Contest",
            icon: PlusCircle,
            url: "/admin/contests/create",
            permission: "create-contest",
          },
          // {
          //   title: "Manage Contests",
          //   icon: Settings2,
          //   url: "/admin/contests",
          //   permission: "manage-contests",
          // }
        ],
      },
      {
        title: "User Management",
        icon: Users,
        children: [
          {
            title: "All Users",
            icon: Users2,
            url: "/users",
            permission: "manage-users",
          },
          {
            title: "User Roles",
            icon: UserCog,
            url: "/roles",
            permission: "manage-roles",
          }
        ],
      },
      {
        title: "Wallet Management",
        icon: Wallet,
        children: [
          {
            title: "Deposits",
            icon: ArrowDownToLine,
            url: "/admin/deposits",
            permission: "manage-deposits",
          },
          {
            title: "Withdrawals",
            icon: ArrowUpFromLine,
            url: "/admin/withdrawals",
            permission: "manage-withdrawals",
          },
           {
            title: "Price",
            icon: TrophyIcon,
            url: "/admin/price",
            permission: "manage-price",
          }
        ],
      },
      {
        title: "Platform Settings",
        icon: Settings,
        children: [
          {
            title: "General Settings",
            icon: Wrench,
            url: "/admin/settings",
            permission: "manage-settings",
          },
          {
            title: "Announcements",
            icon: Bell,
            url: "/admin/announcements",
            permission: "manage-announcements",
          },
          {
            title: "Reports",
            icon: FileText,
            url: "/admin/reports",
            permission: "view-reports",
          }
        ],
      }
    ],
  }
];
// Memoized selector for permissions
const selectPermissions = createSelector(
  // Input selector gets the raw permissions array
  (state) => state.auth.user?.role?.permissions || [],
  // Transform the permissions in the result function
  (permissions) => {
    // Only create new array if there are actual transformations
    return permissions.reduce((acc, p) => {
      const permName = p.permission?.name?.toLowerCase();
      if (permName) {
        acc.push({
          name: permName,
          type: p.type || "",
        });
      }
      return acc;
    }, []);
  }
);

// Selector for current user details
const selectCurrentUser = createSelector(
  (state) => state.auth.user,
  (user) => ({
    name:
      user?.name ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      "User",
  })
);

export default function DashboardSidebar() {
  const [openItems, setOpenItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const { toggleSidebar } = useSidebar();
  const { themeColor } = useThemeContext();
  // State to track if the screen is mobile
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size on mount and on resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };

    checkMobile(); // Check on mount
    window.addEventListener("resize", checkMobile); // Update on resize

    return () => window.removeEventListener("resize", checkMobile); // Cleanup
  }, []);

  // Use the memoized selector
  const processedPermissions = useSelector(selectPermissions);
  const currentUser = useSelector(selectCurrentUser);

  // Memoized function to check if an item is permitted
  const isItemPermitted = useCallback(
    (permission) => {
      // If no permissions, show everything
      if (processedPermissions.length === 0) return true;
      if (!permission) return false;

      // Split the permission into words
      const permissionWords = permission.toLowerCase().split("-");

      return processedPermissions.some((perm) => {
        if (!perm.name) return false;

        // Split the permission name into words
        const permissionNameWords = perm.name.split("-");

        // Check if all words in the permission match
        return permissionWords.every((word) =>
          permissionNameWords.includes(word)
        );
      });
    },
    [processedPermissions]
  );

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    if (processedPermissions.length === 0) return []; // Show all if permissions are empty
    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            isItemPermitted(item.permission) ||
            // If the item has children, keep it if any child is permitted
            (item.children &&
              item.children.some((child) => isItemPermitted(child.permission)))
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [isItemPermitted, processedPermissions]);

  const toggleItem = (title) => {
    setOpenItems((prevOpenItems) =>
      prevOpenItems.includes(title)
        ? prevOpenItems.filter((item) => item !== title)
        : [...prevOpenItems, title]
    );
  };

  const handleItemClick = (title) => {
    setActiveItem(title);
    if (isMobile) {
      toggleSidebar();
    }
  };

  const getThemeStyles = (isActive) => {
    const baseStyles = "transition-colors";
    const activeStyles = isActive
      ? `text-${themeColor}-500 border-r-[3px] border-${themeColor}-500`
      : "";
    const hoverStyles = `hover:text-${themeColor}-500`;
    return cn(baseStyles, activeStyles, hoverStyles);
  };
  return (
    <Sidebar className="scrollbar-thin">
      <SidebarHeader className="px-6 py-4 ">
        <div className="flex items-center justify-center  text-xl font-semibold">
         <div className="flex items-center space-x-2 w-full">
              <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                StockVerses
              </span>
            </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 mb-0 scrollbar-thin">
        {filteredNavigation.length === 0 ? (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4 mx-3"
            role="alert"
          >
            <strong className="font-bold">Hello!</strong>
            <span className="block sm:inline">
              {" "}
              You need to ask Admin to give permission view the navigation.
            </span>
          </div>
        ) : (
          filteredNavigation.map((group) => (
            <SidebarGroup className=" pb-0" key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="pl-2  overflow-hidden">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      {item.children ? (
                        <Collapsible
                          open={openItems.includes(item.title)}
                          onOpenChange={() => toggleItem(item.title)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              className={cn(
                                "w-full justify-between",
                                getThemeStyles(activeItem === item.title)
                              )}
                              onClick={() => handleItemClick(item.title)}
                            >
                              <span className="flex items-center ">
                                <item.icon className="h-4 w-4 mr-2" />
                                <span className=" pl-2">{item.title}</span>
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  openItems.includes(item.title)
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenu
                              className={`mt-2 ml-6 space-y-1 ${submenuLineStyles}`}
                            >
                              {item.children.map((child, index) => (
                                <SidebarMenuItem
                                  key={child.title}
                                  className={
                                    index === item.children.length - 1
                                      ? "pb-1"
                                      : ""
                                  }
                                >
                                  <SidebarMenuButton
                                    asChild
                                    className={cn(
                                      "pl-2 flex items-center whitespace-nowrap overflow-hidden text-ellipsis",
                                      getThemeStyles(activeItem === child.title)
                                    )}
                                    onClick={() => handleItemClick(child.title)}
                                  >
                                    <Link
                                      to={child.url}
                                      className="flex items-center"
                                    >
                                      <span
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full mr-2 relative z-10",
                                          activeItem === child.title
                                            ? `bg-${themeColor}-500`
                                            : "bg-gray-300"
                                        )}
                                      />
                                      <span className="truncate">
                                        {child.title}
                                      </span>
                                    </Link>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        <SidebarMenuButton
                          asChild
                          className={
                            getThemeStyles(activeItem === item.title) +
                            `hover:text-${themeColor}-500`
                          }
                          onClick={() => handleItemClick(item.title)}
                        >
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4 mr-2" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="overflow-hidden">
        <SidebarMenu>
          <SidebarMenuSubItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuSubButton className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{currentUser.name}</span>
                  </div>
                  <Settings className="h-4 w-4" />
                </SidebarMenuSubButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <Link to={"profile"}>Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help & Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuSubItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
