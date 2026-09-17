import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';

import { fDate } from 'src/utils/format-time';

import { Chart, useChart } from 'src/components/chart';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export function RestockTrendChartCard({ dailyChart, chartColors }) {
  const chartOptions = useChart({
    chart: { stacked: true },
    colors: chartColors,
    stroke: { width: 0 },
    legend: { show: true, position: 'top', horizontalAlign: 'right' },
    xaxis: { categories: dailyChart.days.map((d) => fDate(d, 'D MMM')) },
    yaxis: { title: { text: 'จำนวนชิ้น' }, forceNiceScale: true },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
    tooltip: { y: { formatter: (v) => `${v} ชิ้น` } },
  });

  return (
    <Card sx={{ height: 1 }}>
      <CardHeader
        avatar={<SectionAvatar icon="solar:chart-2-bold-duotone" color="info" />}
        title="แนวโน้มการเติมผ้า 30 วันล่าสุด"
        subheader="แต่ละแท่ง = 1 วัน แยกสีตามหมวดหมู่ผ้า เพื่อดูว่าวันไหนใช้ผ้าเยอะที่สุด"
      />
      <Box sx={{ p: 2.5 }}>
        <Chart type="bar" series={dailyChart.series} options={chartOptions} height={360} />
      </Box>
    </Card>
  );
}
