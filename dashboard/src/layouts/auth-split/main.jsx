import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { layoutClasses } from 'src/layouts/classes';

// ----------------------------------------------------------------------

export function Main({ sx, children, layoutQuery, ...other }) {
  const theme = useTheme();

  return (
    <Box
      component="main"
      className={layoutClasses.main}
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        [theme.breakpoints.up(layoutQuery)]: {
          flexDirection: 'row',
        },
        ...sx,
      }}
      {...other}
    >
      {children}
    </Box>
  );
}

// ----------------------------------------------------------------------

export function Content({ sx, children, layoutQuery, ...other }) {
  const theme = useTheme();

  const renderContent = (
    <Box
      sx={{
        width: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 'var(--layout-auth-content-width)',
        [theme.breakpoints.up(layoutQuery)]: {
          transform: 'translateY(-10%)',
        },
      }}
    >
      {children}
    </Box>
  );

  return (
    <Box
      className={layoutClasses.content}
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        alignItems: 'center',
        flexDirection: 'column',
        p: theme.spacing(3, 2, 10, 2),
        [theme.breakpoints.up(layoutQuery)]: {
          flex: '1 1 0%',
          minWidth: 0,
          position: 'relative',
          bgcolor: 'background.default',
          justifyContent: 'center',
          p: theme.spacing(10, 4, 10, 4),
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
          boxShadow: '-56px 0 64px -32px rgba(0, 0, 0, 0.28)',
        },
        ...sx,
      }}
      {...other}
    >
      {renderContent}
    </Box>
  );
}
