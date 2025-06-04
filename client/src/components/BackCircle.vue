<!-- BackCircle.vue -->
<template>
    <div class="backcircle-container" ref="wcContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';
import 'echarts-wordcloud';

let chartInstance: echarts.ECharts | null = null;
const wcContainer = ref<HTMLElement | null>(null);
console.log(wcContainer)

onMounted(() => {
    if (!wcContainer.value) return;
    chartInstance = echarts.init(wcContainer.value);

    const width = wcContainer.value.clientWidth;
    const height = wcContainer.value.clientHeight;

    const circleEl = document.querySelector('.circle-card') as HTMLElement;
    if (!circleEl) return;

    const circleRect = circleEl.getBoundingClientRect();
    const containerRect = wcContainer.value.getBoundingClientRect();
    const radius = circleEl.clientWidth / 2;
    const cx = circleRect.left - containerRect.left + radius;
    const cy = circleRect.top - containerRect.top + radius;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const ctx = maskCanvas.getContext('2d')!;
    console.log(ctx)

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 可选：调试用背景
    const debugDataUrl = maskCanvas.toDataURL('image/png');
    wcContainer.value.style.backgroundImage = `url(${debugDataUrl})`;
    wcContainer.value.style.backgroundSize = 'cover';

    const maskImage = new Image();
    maskImage.src = maskCanvas.toDataURL('image/png');
    maskImage.onload = () => {
        const option: echarts.EChartsOption = {
            tooltip: { show: true },
            series: [
                {
                    type: 'wordCloud',
                    maskImage: maskImage,
                    gridSize: 8,
                    sizeRange: [20, 60],
                    rotationRange: [-90, 90],
                    drawOutOfBound: false,
                    textStyle: {
                        fontFamily: 'sans-serif',
                        color: () => {
                            return (
                                'rgb(' +
                                [
                                    Math.round(Math.random() * 160),
                                    Math.round(Math.random() * 160),
                                    Math.round(Math.random() * 160),
                                ].join(',') +
                                ')'
                            );
                        },
                    },
                    emphasis: {
                        focus: 'self',
                        textStyle: { shadowBlur: 10, shadowColor: '#333' },
                    },
                    data: [
 { name: 'Vue', value: 100 },
            { name: 'React', value: 95 },
            { name: 'Angular', value: 70 },
            { name: 'JavaScript', value: 90 },
            { name: 'TypeScript', value: 85 },
            { name: 'Node.js', value: 75 },
            { name: 'Deno', value: 30 },
            { name: 'Rust', value: 45 },
            { name: 'Go', value: 50 },
            { name: 'Python', value: 60 },
            { name: 'Webpack', value: 40 },
            { name: 'Vite', value: 50 },
            { name: 'Rollup', value: 25 },
            { name: 'esbuild', value: 35 },
            { name: 'Parcel', value: 15 },
            { name: 'CSS3', value: 55 },
            { name: 'HTML5', value: 60 },
            { name: 'TailwindCSS', value: 48 },
            { name: 'Sass', value: 30 },
            { name: 'Less', value: 20 },
            { name: 'PostCSS', value: 28 },
            { name: 'ECharts', value: 65 },
            { name: 'D3', value: 22 },
            { name: 'Three.js', value: 27 },
            { name: 'RxJS', value: 18 },
            { name: 'GraphQL', value: 38 },
            { name: 'Jest', value: 33 },
            { name: 'Playwright', value: 26 },
            { name: 'Cypress', value: 29 },
            { name: 'ESLint', value: 41 },
            { name: 'Prettier', value: 36 },
            { name: 'Docker', value: 58 },
            { name: 'Kubernetes', value: 32 },
            { name: 'Git', value: 70 },
            { name: 'GitHub', value: 65 },
                    ],
                },
            ],
        };
        chartInstance!.setOption(option);
    };

    window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
    if (chartInstance) {
        chartInstance.dispose();
        chartInstance = null;
    }
    window.removeEventListener('resize', resizeChart);
});

function resizeChart() {
    if (!chartInstance || !wcContainer.value) return;
    chartInstance.resize();

    const width = wcContainer.value.clientWidth;
    const height = wcContainer.value.clientHeight;
    const circleEl = document.querySelector('.circle-card') as HTMLElement;
    if (!circleEl) return;

    const circleRect = circleEl.getBoundingClientRect();
    const containerRect = wcContainer.value.getBoundingClientRect();
    const radius = circleEl.clientWidth / 2;
    const cx = circleRect.left - containerRect.left + radius;
    const cy = circleRect.top - containerRect.top + radius;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const ctx = maskCanvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const maskImage = new Image();
    maskImage.src = maskCanvas.toDataURL('image/png');
    maskImage.onload = () => {
        chartInstance!.setOption({
            series: [{ maskImage: maskImage }],
        });
    };
}
</script>

<style scoped>
.backcircle-container {
    position: absolute;
    top: 30px;
    left: 0;
    width: 100%;
    height: calc(100% - 30px);
    z-index: 0;
    background-color: transparent;
}
</style>
