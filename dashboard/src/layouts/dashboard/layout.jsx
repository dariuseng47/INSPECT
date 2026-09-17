'use client';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { iconButtonClasses } from '@mui/material/IconButton';

import { useBoolean } from 'src/hooks/use-boolean';

import { allLangs } from 'src/locales';
import { _notifications } from 'src/_mock';
import { useGetMyPermissions } from 'src/actions/permissions';

import { Logo } from 'src/components/logo';
import { useSettingsContext } from 'src/components/settings';
import { PostLoginPopup } from 'src/components/post-login-popup';

import { useAuthContext } from 'src/auth/hooks';

import { Main } from './main';
import { NavMobile } from './nav-mobile';
import { layoutClasses } from '../classes';
import { NavVertical } from './nav-vertical';
import { NavHorizontal } from './nav-horizontal';
import { Searchbar } from '../components/searchbar';
import { getNavData } from '../config-nav-dashboard';
import { MenuButton } from '../components/menu-button';
import { LayoutSection } from '../core/layout-section';
import { HeaderSection } from '../core/header-section';
import { StyledDivider, useNavColorVars } from './styles';
import { SignOutButton } from '../components/sign-out-button';
import { SettingsButton } from '../components/settings-button';
import { LanguagePopover } from '../components/language-popover';
import { NotificationsDrawer } from '../components/notifications-drawer';

// ----------------------------------------------------------------------

export function DashboardLayout({ sx, children, header, data }) {
  const theme = useTheme();

  const mobileNavOpen = useBoolean();

  const settings = useSettingsContext();

  const navColorVars = useNavColorVars(theme, settings);

  const layoutQuery = 'lg';

  const { user } = useAuthContext();

  const { myPermissions } = useGetMyPermissions();

  const navData = data?.nav ?? getNavData(user?.role, { permissions: myPermissions });

  const isNavMini = settings.navLayout === 'mini';
  const isNavHorizontal = settings.navLayout === 'horizontal';
  const isNavVertical = isNavMini || settings.navLayout === 'vertical';

  return (
    <>
      <PostLoginPopup />

      <LayoutSection
        /** **************************************
         * Header
         *************************************** */
        headerSection={
          <HeaderSection
            layoutQuery={layoutQuery}
            disableElevation={isNavVertical}
            slotProps={{
              toolbar: {
                sx: {
                  ...(isNavHorizontal && {
                    bgcolor: 'var(--layout-nav-bg)',
                    [`& .${iconButtonClasses.root}`]: {
                      color: 'var(--layout-nav-text-secondary-color)',
                    },
                    [theme.breakpoints.up(layoutQuery)]: {
                      height: 'var(--layout-nav-horizontal-height)',
                    },
                  }),
                },
              },
              container: {
                maxWidth: false,
                sx: {
                  ...(isNavVertical && { px: { [layoutQuery]: 5 } }),
                },
              },
            }}
            sx={header?.sx}
            slots={{
              topArea: (
                <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
                  This is an info Alert.
                </Alert>
              ),
              bottomArea: isNavHorizontal ? (
                <NavHorizontal
                  data={navData}
                  layoutQuery={layoutQuery}
                  cssVars={navColorVars.section}
                />
              ) : null,
              leftArea: (
                <>
                  {/* -- Nav mobile -- */}
                  <MenuButton
                    onClick={mobileNavOpen.onTrue}
                    sx={{
                      mr: 1,
                      ml: -1,
                      [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                    }}
                  />
                  <NavMobile
                    data={navData}
                    open={mobileNavOpen.value}
                    onClose={mobileNavOpen.onFalse}
                    cssVars={navColorVars.section}
                  />
                  {/* -- Logo -- */}
                  {isNavHorizontal && (
                    <Logo
                      sx={{
                        display: 'none',
                        [theme.breakpoints.up(layoutQuery)]: {
                          display: 'inline-flex',
                        },
                      }}
                    />
                  )}
                  {/* -- Divider -- */}
                  {isNavHorizontal && (
                    <StyledDivider
                      sx={{
                        [theme.breakpoints.up(layoutQuery)]: { display: 'flex' },
                      }}
                    />
                  )}
                </>
              ),
              rightArea: (
                <Box display="flex" alignItems="center" gap={{ xs: 0, sm: 0.75 }}>
                  {/* -- Greeting -- */}
                  {user?.full_name && (
                    <Typography
                      variant="subtitle2"
                      noWrap
                      sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}
                    >
                      สวัสดี, {user.full_name}
                    </Typography>
                  )}
                  {/* -- Searchbar -- */}
                  <Searchbar data={navData} />
                  {/* -- Language popover -- */}
                  <LanguagePopover data={allLangs} />
                  {/* -- Notifications popover -- */}
                  <NotificationsDrawer data={_notifications} />
                  {/* -- Settings button -- */}
                  <SettingsButton />
                  {/* -- Logout button -- */}
                  <SignOutButton iconOnly />
                </Box>
              ),
            }}
          />
        }
        /** **************************************
         * Sidebar
         *************************************** */
        sidebarSection={
          isNavHorizontal ? null : (
            <NavVertical
              data={navData}
              isNavMini={isNavMini}
              layoutQuery={layoutQuery}
              cssVars={navColorVars.section}
              onToggleNav={() =>
                settings.onUpdateField(
                  'navLayout',
                  settings.navLayout === 'vertical' ? 'mini' : 'vertical'
                )
              }
            />
          )
        }
        /** **************************************
         * Footer
         *************************************** */
        footerSection={null}
        /** **************************************
         * Style
         *************************************** */
        cssVars={{
          ...navColorVars.layout,
          '--layout-transition-easing': 'linear',
          '--layout-transition-duration': '120ms',
          '--layout-nav-mini-width': '88px',
          '--layout-nav-vertical-width': '300px',
          '--layout-nav-horizontal-height': '64px',
          '--layout-dashboard-content-pt': theme.spacing(1),
          '--layout-dashboard-content-pb': theme.spacing(8),
          '--layout-dashboard-content-px': theme.spacing(5),
        }}
        sx={{
          [`& .${layoutClasses.hasSidebar}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
              pl: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
            },
          },
          ...sx,
        }}
      >
        <Main isNavHorizontal={isNavHorizontal}>{children}</Main>
      </LayoutSection>
    </>
  );
}
