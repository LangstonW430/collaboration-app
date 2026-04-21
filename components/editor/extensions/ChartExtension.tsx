'use client'

import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
)

type ChartType = 'bar' | 'line' | 'pie' | 'doughnut'

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function ChartView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const chartType = (node.attrs.chartType as ChartType) ?? 'bar'
  const chartTitle = (node.attrs.chartTitle as string) ?? ''
  const labelsStr = (node.attrs.labels as string) ?? 'A, B, C'
  const dataStr = (node.attrs.data as string) ?? '10, 20, 15'
  const colorsStr = (node.attrs.colors as string) ?? CHART_COLORS.slice(0, 3).join(', ')

  const [draftType, setDraftType] = useState<ChartType>(chartType)
  const [draftTitle, setDraftTitle] = useState(chartTitle)
  const [draftLabels, setDraftLabels] = useState(labelsStr)
  const [draftData, setDraftData] = useState(dataStr)
  const [draftColors, setDraftColors] = useState(colorsStr)

  useEffect(() => {
    if (editing) {
      setDraftType(chartType)
      setDraftTitle(chartTitle)
      setDraftLabels(labelsStr)
      setDraftData(dataStr)
      setDraftColors(colorsStr)
    }
  }, [editing])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(e.target as globalThis.Node)) {
        setEditing(false)
      }
    }
    if (editing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editing])

  function applyEdits() {
    updateAttributes({
      chartType: draftType,
      chartTitle: draftTitle,
      labels: draftLabels,
      data: draftData,
      colors: draftColors,
    })
    setEditing(false)
  }

  const parsedLabels = labelsStr.split(',').map((s) => s.trim()).filter(Boolean)
  const parsedData = dataStr.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
  const parsedColors = colorsStr.split(',').map((s) => s.trim()).filter(Boolean)

  const bgColors = parsedLabels.map((_, i) => parsedColors[i] ?? CHART_COLORS[i % CHART_COLORS.length])
  const borderColors = bgColors.map((c) => c)

  const chartData = {
    labels: parsedLabels,
    datasets: [
      {
        label: chartTitle || 'Dataset',
        data: parsedData,
        backgroundColor: (chartType === 'pie' || chartType === 'doughnut')
          ? bgColors.map((c) => c + 'cc')
          : bgColors[0] + 'cc',
        borderColor: (chartType === 'pie' || chartType === 'doughnut') ? borderColors : borderColors[0],
        borderWidth: 2,
        fill: chartType === 'line',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: chartType === 'pie' || chartType === 'doughnut' },
      title: { display: !!chartTitle, text: chartTitle },
    },
  }

  const ChartComponent = { bar: Bar, line: Line, pie: Pie, doughnut: Doughnut }[chartType]

  const isEditable = editor?.isEditable

  return (
    <NodeViewWrapper>
      <div
        className={`relative my-4 rounded-xl border-2 transition-colors ${selected ? 'border-blue-400' : 'border-gray-100 hover:border-gray-200'} bg-white`}
        contentEditable={false}
      >
        {/* Chart render */}
        <div className="p-4" style={{ maxHeight: 360 }}>
          <ChartComponent data={chartData} options={chartOptions} />
        </div>

        {/* Edit button */}
        {isEditable && (
          <button
            onClick={() => setEditing(true)}
            className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-colors"
            title="Edit chart"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Inline editor panel */}
        {editing && (
          <div
            ref={editorRef}
            className="absolute top-0 right-0 bottom-0 w-72 bg-white border-l border-gray-200 rounded-r-xl p-4 shadow-xl z-20 overflow-y-auto"
          >
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Edit Chart</h3>

            {/* Chart type */}
            <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {(['bar', 'line', 'pie', 'doughnut'] as ChartType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDraftType(t)}
                  className={`text-xs py-1 px-1 rounded-md border capitalize transition-colors ${draftType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Title */}
            <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Chart title"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3 outline-none focus:border-blue-400"
            />

            {/* Labels */}
            <label className="text-xs font-medium text-gray-500 mb-1 block">Labels (comma-separated)</label>
            <input
              type="text"
              value={draftLabels}
              onChange={(e) => setDraftLabels(e.target.value)}
              placeholder="Jan, Feb, Mar"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3 outline-none focus:border-blue-400"
            />

            {/* Data */}
            <label className="text-xs font-medium text-gray-500 mb-1 block">Values (comma-separated)</label>
            <input
              type="text"
              value={draftData}
              onChange={(e) => setDraftData(e.target.value)}
              placeholder="10, 25, 15"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3 outline-none focus:border-blue-400"
            />

            {/* Colors */}
            <label className="text-xs font-medium text-gray-500 mb-1 block">Colors (comma-separated hex)</label>
            <input
              type="text"
              value={draftColors}
              onChange={(e) => setDraftColors(e.target.value)}
              placeholder="#3b82f6, #ef4444"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mb-1 outline-none focus:border-blue-400"
            />
            <div className="flex gap-1 flex-wrap mb-4">
              {CHART_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraftColors(c)}
                  style={{ background: c }}
                  className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                  title={c}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={applyEdits}
                className="flex-1 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ChartExtension = TiptapNode.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: { default: 'bar' },
      chartTitle: { default: '' },
      labels: { default: 'Jan, Feb, Mar, Apr, May' },
      data: { default: '10, 25, 15, 30, 20' },
      colors: { default: CHART_COLORS.slice(0, 5).join(', ') },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-chart-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-chart-type': HTMLAttributes.chartType })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartView)
  },
})
