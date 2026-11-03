import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthApi, AuthGate } from './src/auth/AuthGate';
import { NavProvider, useNav } from './src/components/nav';
import { Shell } from './src/components/Shell';
import { DataProvider } from './src/data/store';
import { MoreScreen, NotificationsScreen, PersonPage, SettingsScreen, TeamScreen } from './src/screens/Account';
import { AttendanceScreen } from './src/screens/Attendance';
import { ContractorDetail, ContractorsScreen } from './src/screens/Contractors';
import { DashboardScreen } from './src/screens/Dashboard';
import { DataExportScreen } from './src/screens/DataExport';
import { GalleryScreen } from './src/screens/Gallery';
import { PayrollScreen } from './src/screens/Payroll';
import { ProjectDetail, ProjectsScreen } from './src/screens/Projects';
import { ReportsScreen } from './src/screens/Reports';
import { SearchScreen } from './src/screens/Search';
import { SubmittalDetail, SubmittalsScreen } from './src/screens/Submittals';
import { TaskDetail, TasksScreen } from './src/screens/Tasks';
import { TrackerScreen } from './src/screens/Tracker';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function Router({ auth }: { auth: AuthApi }) {
  const { route } = useNav();
  const id = route.id ?? '';
  // key forces a fresh screen (and filters) when params change
  const key = `${route.name}/${id}/${JSON.stringify(route.params ?? {})}`;
  switch (route.name) {
    case 'tasks':
      return <TasksScreen key={key} />;
    case 'task':
      return <TaskDetail key={key} id={id} />;
    case 'projects':
      return <ProjectsScreen key={key} />;
    case 'project':
      return <ProjectDetail key={key} id={id} />;
    case 'submittals':
      return <SubmittalsScreen key={key} params={route.params} />;
    case 'tracker':
      return <TrackerScreen key={key} params={route.params} />;
    case 'submittal':
      return <SubmittalDetail key={key} id={id} />;
    case 'contractors':
      return <ContractorsScreen key={key} />;
    case 'contractor':
      return <ContractorDetail key={key} id={id} />;
    case 'attendance':
      return <AttendanceScreen key={key} />;
    case 'payroll':
      return <PayrollScreen key={key} />;
    case 'gallery':
      return <GalleryScreen key={key} params={route.params} />;
    case 'reports':
      return <ReportsScreen key={key} params={route.params} />;
    case 'search':
      return <SearchScreen key={key} />;
    case 'notifications':
      return <NotificationsScreen key={key} />;
    case 'team':
      return <TeamScreen key={key} />;
    case 'person':
      return <PersonPage key={key} id={id} />;
    case 'settings':
      return <SettingsScreen key={key} auth={auth} />;
    case 'data':
      return <DataExportScreen key={key} onRestored={auth.signOut} />;
    case 'more':
      return <MoreScreen key={key} />;
    default:
      return <DashboardScreen key={key} />;
  }
}

function Themed() {
  const { dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AuthGate>
        {(auth) => (
          <DataProvider key={auth.user.id} me={auth.user}>
            <NavProvider>
              <Shell>
                <Router auth={auth} />
              </Shell>
            </NavProvider>
          </DataProvider>
        )}
      </AuthGate>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Themed />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
