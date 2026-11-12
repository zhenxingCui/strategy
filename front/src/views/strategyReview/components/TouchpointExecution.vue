<template>
  <section class="card touchpoint-section">
    <div class="card-header">
      <div class="card-title">
        <span class="card-title-dot"></span>
        策略触点执行情况
      </div>
    </div>

    <div class="card-body">
      <div class="grid-two-col">
        <!-- ===== 左侧：触点执行 ===== -->
        <div class="left-panel">
          <!-- 上块：与右侧策略分类执行情况统一高度，保证左右分界线对齐 -->
          <div class="top-block">
          <div class="panel-title-row">
            <div class="panel-title">
              <span class="panel-dot blue"></span>
              触点执行
            </div>
            <div class="panel-filters">
              <el-button type="text" size="mini" icon="el-icon-download" @click="handleLeftExport">导出</el-button>
            </div>
          </div>
          <el-table
            :data="leftTableDataWithTotal"
            v-loading="leftLoading"
            border
            stripe
            size="mini"
            @row-click="handleLeftRowClick"
            @sort-change="handleLeftSort"
            :row-class-name="leftRowClass"
            height="100%"
          >
            <el-table-column type="selection" width="36" />
            <el-table-column v-for="col in leftColumns" :key="col.key"
              :prop="col.key"
              :label="col.label"
              :sortable="col.sortable ? 'custom' : false"
              :align="col.align || 'right'"
              :min-width="col.width || 90"
            >
              <template slot-scope="{ row }">
                <template v-if="col.key === 'channel'">
                  <span v-if="row._isTotal" class="total-label">{{ row.channel }}</span>
                  <span v-else class="channel-tag" :style="channelStyle(row.channel)">{{ getChannelLabel(row) }}</span>
                </template>
                <template v-else-if="col.qoqField">
                  <div class="cell-with-qoq">
                    <span>{{ formatNum(row[col.key], col.key) }}</span>
                    <span v-if="row[col.qoqField] != null" class="qoq-badge" :class="row[col.qoqField] >= 0 ? 'up' : 'down'">
                      {{ row[col.qoqField] >= 0 ? '+' : '' }}{{ row[col.qoqField].toFixed(1) + '%' }}
                    </span>
                  </div>
                </template>
                <template v-else>{{ formatNum(row[col.key], col.key) }}</template>
              </template>
            </el-table-column>
          </el-table>
          <!-- 与右侧 .table-footer 等高的占位：让左侧表格底边（横向滚动条）与右侧表格滚动条处于同一水平线 -->
          <div class="footer-spacer"></div>
          </div>

          <!-- 触点产能趋势 + 业务产能明细（渠道行点击联动，左右并排） -->
          <div class="channel-bottom-grid">
            <!-- 触点产能趋势 -->
            <div class="channel-detail-card">
              <div class="detail-title-row">
                <div class="detail-title">
                  <span class="detail-dot blue"></span>
                  触点产能趋势
                </div>
                <div class="detail-subtitle">{{ activeChannelLabel }}{{ activeBigCategory ? ' / ' + activeBigCategory : '' }}{{ activeSmallCategory ? ' / ' + activeSmallCategory : '' }}</div>
              </div>
              <div class="chart-legend-mini">
                <div class="legend-item">
                  <span class="legend-bar" style="background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);"></span>
                  <span>产能</span>
                </div>
                <div class="legend-item">
                  <span class="legend-line-dot" style="background: #f59e0b;"></span>
                  <span>环比</span>
                </div>
              </div>
              <div class="trend-chart" ref="trendChartWrap">
                <e-chart :option="channelChartOption" :loading="channelTrendLoading" height="240px" />
              </div>
            </div>

            <!-- 业务产能明细 -->
            <div class="channel-detail-card">
              <div class="detail-title-row">
                <div class="detail-title">
                  <span class="detail-dot blue"></span>
                  业务产能明细
                </div>
                <div class="detail-subtitle">{{ activeChannelLabel }}{{ activeBigCategory ? ' / ' + activeBigCategory : '' }}{{ activeSmallCategory ? ' / ' + activeSmallCategory : '' }}</div>
              </div>
              <div class="biz-table-inner" ref="bizTableWrap">
                <el-table
                  :data="channelBizList"
                  v-loading="channelBizLoading"
                  size="mini"
                  :show-header="true"
                  :height="bizTableH"
                >
                <el-table-column prop="bizName" label="业务" align="left" />
                <el-table-column prop="capacity" label="产能" align="right" width="80" />
              </el-table>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 右侧：策略分类执行情况 + 策略执行情况 ===== -->
        <div class="right-panel">
          <!-- 上方：策略分类执行情况（与左侧触点执行统一高度） -->
          <div class="category-block top-block">
            <div class="panel-title-row">
              <div class="panel-title">
                <span class="panel-dot blue"></span>
                策略分类执行情况
              </div>
              <div class="category-breadcrumb" v-if="activeBigCategory || activeSmallCategory">
                <span v-if="activeBigCategory">{{ isControl ? '大类' : '大类' }}：{{ activeBigCategory }}</span>
                <span v-if="activeSmallCategory"> / {{ isControl ? '小类' : '小类' }}：{{ activeSmallCategory }}</span>
                <el-button type="text" size="mini" @click="clearCategoryFilter">查看全部</el-button>
              </div>
            </div>
            <!-- 筛选栏 -->
            <div class="filter-bar">
              <el-date-picker
                v-model="categoryFilter.month"
                type="month"
                placeholder="选择月份"
                size="mini"
                value-format="yyyy-MM"
                style="width: 140px;"
              />
              <el-select v-model="categoryFilter.bigCategory" :placeholder="isControl ? '场景大类' : '策略大类'" clearable size="mini" style="width: 110px;" @change="onBigCategoryChange">
                <el-option v-for="c in bigCategoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
              <el-select v-model="categoryFilter.smallCategory" :placeholder="isControl ? '场景小类' : '策略小类'" clearable size="mini" style="width: 110px;" :disabled="!categoryFilter.bigCategory">
                <el-option v-for="c in smallCategoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
              <el-select v-model="categoryFilter.channel" placeholder="触点" clearable size="mini" style="width: 100px;">
                <el-option label="全部渠道" value="全部" />
                <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
              <el-button type="primary" size="mini" @click="handleCategorySearch">搜索</el-button>
              <el-button size="mini" @click="handleCategoryReset">重置</el-button>
              <div style="flex: 1;"></div>
              <el-button type="text" icon="el-icon-full-screen" @click="showCategoryFullscreen = true" title="全屏查看">全屏</el-button>
              <el-button type="text" icon="el-icon-download" @click="handleCategoryExport">导出</el-button>
            </div>
            <el-table
              :data="categoryTableDataWithTotal"
              v-loading="categoryLoading"
              border
              stripe
              size="mini"
              @sort-change="handleCategorySort"
              :row-class-name="categoryRowClass"
              height="100%"
            >
              <el-table-column
                prop="bigCategory"
                :label="isControl ? '场景大类' : '策略大类'"
                align="left"
                width="100"
              >
                <template slot-scope="{ row }">
                  <span v-if="row._isTotal" class="total-label">{{ row.bigCategory }}</span>
                  <span v-else class="category-link" :class="{ active: row.bigCategory === activeBigCategory }" @click="handleBigClick(row.bigCategory)">
                    {{ row.bigCategory }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                prop="smallCategory"
                :label="isControl ? '场景小类' : '策略小类'"
                align="left"
                width="100"
              >
                <template slot-scope="{ row }">
                  <span v-if="row._isTotal" class="total-label">{{ row.smallCategory }}</span>
                  <span v-else class="category-link" :class="{ active: row.smallCategory === activeSmallCategory, disabled: !activeBigCategory }" @click="activeBigCategory && handleSmallClick(row.smallCategory)">
                    {{ row.smallCategory }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column v-for="col in categoryColumns" :key="col.key"
                :prop="col.key"
                :label="col.label"
                :sortable="col.sortable ? 'custom' : false"
                :align="col.align || 'right'"
                :min-width="col.width || 90"
              >
                <template slot-scope="{ row }">
                  <template v-if="col.qoqField">
                    <div class="cell-with-qoq">
                      <span>{{ formatNum(row[col.key], col.key) }}</span>
                      <span v-if="row[col.qoqField] != null" class="qoq-badge" :class="row[col.qoqField] >= 0 ? 'up' : 'down'">
                        {{ (row[col.qoqField] >= 0 ? '+' : '') + row[col.qoqField].toFixed(1) + '%' }}
                      </span>
                    </div>
                  </template>
                  <template v-else>{{ formatNum(row[col.key], col.key) }}</template>
                </template>
              </el-table-column>
            </el-table>
            <div class="table-footer pagination-only">
              <el-pagination
                background
                layout="prev, pager, next"
                :total="categoryTotalCount"
                :page-size="categoryPageSize"
                :current-page.sync="categoryPage"
                small
                style="text-align: right;"
              />
            </div>
          </div>

          <!-- 下方：策略执行情况 -->
          <div class="strategy-block">
            <div class="panel-title-row">
              <div class="panel-title">
                <span class="panel-dot blue"></span>
                策略执行情况
              </div>
              <div class="strategy-selected-tip" v-if="activeStrategy.name || activeBigCategory || activeSmallCategory">
                <span class="tip-label">{{ isControl ? '已选场景' : '已选策略' }}：</span>
                <span class="tip-value">{{ activeStrategy.name || activeSmallCategory || activeBigCategory }}</span>
                <el-button type="text" size="mini" @click="clearStrategyFilter">查看全部</el-button>
              </div>
            </div>
            <!-- 筛选栏 -->
            <div class="filter-bar">
              <el-date-picker
                v-model="rightFilter.month"
                type="month"
                placeholder="选择月份"
                size="mini"
                value-format="yyyy-MM"
                style="width: 140px;"
              />
              <el-input v-model="rightFilter.strategyName" :placeholder="isControl ? '请输入策略编码' : '请输入策略名'" clearable size="mini" style="width: 140px;" />
              <el-select v-model="rightFilter.channel" placeholder="触点" clearable size="mini" style="width: 100px;">
                <el-option label="全部渠道" value="" />
                <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
              <el-button type="primary" size="mini" @click="handleRightSearch">搜索</el-button>
              <el-button size="mini" @click="handleRightReset">重置</el-button>
              <el-button type="text" icon="el-icon-download" @click="handleRightExport" style="font-size: 12px;">导出</el-button>
              <div style="flex: 1;"></div>
              <el-button type="text" icon="el-icon-full-screen" @click="showRightFullscreen = true" title="全屏查看">全屏</el-button>
              <el-button type="primary" plain size="mini" icon="el-icon-star-off" :loading="favLoading" @click="handleAddFavorite">
                <span style="color: #2563eb;">收藏</span>
              </el-button>
            </div>
            <el-table
              :data="rightTableData"
              v-loading="rightLoading"
              border
              stripe
              size="mini"
              @selection-change="handleRightSelectionChange"
              @row-click="handleRightRowClick"
              @sort-change="handleRightSort"
              :row-class-name="rightRowClass"
              height="100%"
            >
              <el-table-column type="selection" width="36" />
              <el-table-column v-for="col in rightColumns" :key="col.key"
                :prop="col.key"
                :label="col.label"
                :sortable="col.sortable ? 'custom' : false"
                :align="col.align || 'right'"
                :min-width="col.width || 90"
              >
                <template slot-scope="{ row }">
                  <template v-if="col.isCategory">
                    <span class="category-link" :class="{ active: row[col.key] === (col.key === 'bigCategory' ? activeBigCategory : activeSmallCategory) }" @click="handleCategoryCellClick(col.key, row[col.key])">
                      {{ row[col.key] }}
                    </span>
                  </template>
                  <template v-else-if="col.key === 'name'">
                    <span class="strategy-name" :class="{ 'strategy-active': (row.strategyName || row.name) === activeStrategy.name && row.channel === activeStrategy.channel }">
                      {{ row.strategyName || row.name }}
                    </span>
                  </template>
                  <template v-else-if="col.key === 'channel'">
                    <span class="channel-tag" :style="channelStyle(row.channel)">{{ getChannelLabel(row) }}</span>
                  </template>
                  <template v-else-if="col.qoqField">
                    <div class="cell-with-qoq">
                      <span>{{ formatNum(row[col.key], col.key) }}</span>
                      <span class="qoq-badge" :class="row[col.qoqField] >= 0 ? 'up' : 'down'">
                        {{ row[col.qoqField] != null ? (row[col.qoqField] >= 0 ? '+' : '') + row[col.qoqField].toFixed(1) + '%' : '' }}
                      </span>
                    </div>
                  </template>
                  <template v-else>{{ formatNum(row[col.key], col.key) }}</template>
                </template>
              </el-table-column>
            </el-table>
            <div class="table-footer">
              <span>每页{{ rightPageSize }}条</span>
              <el-pagination
                background
                layout="prev, pager, next"
                :total="rightTotal"
                :page-size="rightPageSize"
                :current-page.sync="rightPage"
                small
                style="text-align: right;"
                @current-change="fetchRightData"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 策略分类执行情况 全屏弹窗 -->
    <el-dialog
      :visible.sync="showCategoryFullscreen"
      fullscreen
      append-to-body
      custom-class="table-fullscreen-dialog"
      :show-close="false"
    >
      <div class="fullscreen-header">
        <div class="fullscreen-title">
          <span class="detail-dot blue"></span>
          {{ isControl ? '场景' : '策略' }}分类执行情况
        </div>
        <div class="fullscreen-actions">
          <el-button type="text" icon="el-icon-download" @click="handleCategoryExport">导出</el-button>
          <el-button type="text" icon="el-icon-close" @click="showCategoryFullscreen = false" class="close-fullscreen-btn">关闭</el-button>
        </div>
      </div>
      <!-- 全屏弹窗筛选栏（与主界面一致） -->
      <div class="filter-bar fullscreen-filter-bar">
        <el-date-picker
          v-model="categoryFilter.month"
          type="month"
          placeholder="选择月份"
          size="mini"
          value-format="yyyy-MM"
          style="width: 140px;"
        />
        <el-select v-model="categoryFilter.bigCategory" :placeholder="isControl ? '场景大类' : '策略大类'" clearable size="mini" style="width: 110px;" @change="onBigCategoryChange">
          <el-option v-for="c in bigCategoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="categoryFilter.smallCategory" :placeholder="isControl ? '场景小类' : '策略小类'" clearable size="mini" style="width: 110px;" :disabled="!categoryFilter.bigCategory">
          <el-option v-for="c in smallCategoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="categoryFilter.channel" placeholder="触点" clearable size="mini" style="width: 100px;">
          <el-option label="全部渠道" value="全部" />
          <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <el-button type="primary" size="mini" @click="handleCategorySearch">搜索</el-button>
        <el-button size="mini" @click="handleCategoryReset">重置</el-button>
      </div>
      <el-table
        :data="categoryAllDataWithTotal"
        v-loading="categoryLoading"
        border
        stripe
        size="mini"
        @sort-change="handleCategorySort"
        :row-class-name="categoryRowClass"
        :max-height="categoryFullscreenHeight"
        style="width:100%"
      >
        <el-table-column
          prop="bigCategory"
          :label="isControl ? '场景大类' : '策略大类'"
          align="left"
          width="90"
        >
          <template slot-scope="{ row }">
            <span v-if="row._isTotal" class="total-label">{{ row.bigCategory }}</span>
            <span v-else class="category-link" :class="{ active: row.bigCategory === activeBigCategory }" @click="handleBigClick(row.bigCategory)">
              {{ row.bigCategory }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="smallCategory"
          :label="isControl ? '场景小类' : '策略小类'"
          align="left"
          width="90"
        >
          <template slot-scope="{ row }">
            <span v-if="row._isTotal" class="total-label">{{ row.smallCategory }}</span>
            <span v-else class="category-link" :class="{ active: row.smallCategory === activeSmallCategory, disabled: !activeBigCategory }" @click="activeBigCategory && handleSmallClick(row.smallCategory)">
              {{ row.smallCategory }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-for="col in categoryColumns" :key="col.key"
          :prop="col.key"
          :label="col.label"
          :sortable="col.sortable ? 'custom' : false"
          :align="col.align || 'right'"
          :min-width="col.width || 85"
        >
          <template slot-scope="{ row }">
            <template v-if="col.qoqField">
              <div class="cell-with-qoq">
                <span>{{ formatNum(row[col.key], col.key) }}</span>
                <span v-if="row[col.qoqField] != null" class="qoq-badge" :class="row[col.qoqField] >= 0 ? 'up' : 'down'">
                  {{ (row[col.qoqField] >= 0 ? '+' : '') + row[col.qoqField].toFixed(1) + '%' }}
                </span>
              </div>
            </template>
            <template v-else>{{ formatNum(row[col.key], col.key) }}</template>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 策略执行情况 全屏弹窗 -->
    <el-dialog
      :visible.sync="showRightFullscreen"
      fullscreen
      append-to-body
      custom-class="table-fullscreen-dialog"
      :show-close="false"
    >
      <div class="fullscreen-header">
        <div class="fullscreen-title">
          <span class="detail-dot blue"></span>
          策略执行情况
          <span v-if="activeStrategy.name || activeBigCategory || activeSmallCategory" class="fullscreen-tag">
            {{ activeStrategy.name || activeSmallCategory || activeBigCategory }}
          </span>
        </div>
        <div class="fullscreen-actions">
          <el-button type="text" icon="el-icon-download" @click="handleRightExport">导出</el-button>
          <el-button type="text" icon="el-icon-close" @click="showRightFullscreen = false" class="close-fullscreen-btn">关闭</el-button>
        </div>
      </div>
      <!-- 全屏弹窗筛选栏（与主界面一致） -->
      <div class="filter-bar fullscreen-filter-bar">
        <el-date-picker
          v-model="rightFilter.month"
          type="month"
          placeholder="选择月份"
          size="mini"
          value-format="yyyy-MM"
          style="width: 140px;"
        />
        <el-input v-model="rightFilter.strategyName" :placeholder="isControl ? '请输入策略编码' : '请输入策略名'" clearable size="mini" style="width: 140px;" />
        <el-select v-model="rightFilter.bigCategory" :placeholder="isControl ? '场景大类' : '策略大类'" clearable size="mini" style="width: 110px;" @change="rightFilter.smallCategory = ''">
          <el-option v-for="c in bigCategoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="rightFilter.smallCategory" :placeholder="isControl ? '场景小类' : '策略小类'" clearable size="mini" style="width: 110px;" :disabled="!rightFilter.bigCategory">
          <el-option v-for="c in rightSmallCategoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="rightFilter.channel" placeholder="触点" clearable size="mini" style="width: 100px;">
          <el-option label="全部渠道" value="" />
          <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <el-button type="primary" size="mini" @click="handleRightSearch">搜索</el-button>
        <el-button size="mini" @click="handleRightReset">重置</el-button>
      </div>
      <el-table
        :data="rightTableData"
        v-loading="rightLoading"
        border
        stripe
        size="mini"
        @selection-change="handleRightSelectionChange"
        @row-click="handleRightRowClick"
        @sort-change="handleRightSort"
        :row-class-name="rightRowClass"
        :max-height="rightFullscreenHeight"
        style="width:100%"
      >
        <el-table-column type="selection" width="30" />
        <el-table-column v-for="col in rightColumns" :key="col.key"
          :prop="col.key"
          :label="col.label"
          :sortable="col.sortable ? 'custom' : false"
          :align="col.align || 'right'"
          :min-width="col.width || 90"
        >
          <template slot-scope="{ row }">
            <template v-if="col.isCategory">
              <span class="category-link" :class="{ active: row[col.key] === (col.key === 'bigCategory' ? activeBigCategory : activeSmallCategory) }" @click="handleCategoryCellClick(col.key, row[col.key])">
                {{ row[col.key] }}
              </span>
            </template>
            <template v-else-if="col.key === 'name'">
              <span class="strategy-name" :class="{ 'strategy-active': (row.strategyName || row.name) === activeStrategy.name && row.channel === activeStrategy.channel }">
                {{ row.strategyName || row.name }}
              </span>
            </template>
            <template v-else-if="col.key === 'channel'">
              <span class="channel-tag" :style="channelStyle(row.channel)">{{ getChannelLabel(row) }}</span>
            </template>
            <template v-else-if="col.qoqField">
              <div class="cell-with-qoq">
                <span>{{ formatNum(row[col.key], col.key) }}</span>
                <span class="qoq-badge" :class="row[col.qoqField] >= 0 ? 'up' : 'down'">
                  {{ row[col.qoqField] != null ? (row[col.qoqField] >= 0 ? '+' : '') + row[col.qoqField].toFixed(1) + '%' : '' }}
                </span>
              </div>
            </template>
            <template v-else>{{ formatNum(row[col.key], col.key) }}</template>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </section>
</template>

<script>
import { getChannelSummary, getStrategyList, getDim, getChannelCapacityTrend, getChannelBizCapacity, getCategorySummary, addFavorite } from '@/api/strategyReview'
import { getCityId, getUserId } from '@/utils/auth'
import { chartRows, integerText } from '../active/reviewData'
import { exportTableToCsv } from '../utils/csvExport'
import EChart from '@/components/EChart.vue'

// 渠道颜色映射（与原型保持一致）
const CHANNEL_COLOR_MAP = {
  '在线-外呼': { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  '市级集中': { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
  '在线-瞬时': { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)' },
  '省级在线': { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  '市级营服': { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
  '到厅挽留': { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)' },
  '网格面客': { color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
  '热线': { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' }
}

// 统一解包后端响应：兼容 "data: []"（数组）和 "data: {list:[], total:N}"（分页对象）两种格式
function extractList (res) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.list)) return res.list
  if (Array.isArray(res && res.data)) return res.data
  return []
}
function extractTotal (res, list) {
  if (res && typeof res.total === 'number') return res.total
  return (list || []).length
}
function extractTotalRow (res) {
  return (res && res.calculate) || {}
}

// 三个 tab 的列定义
const LEFT_COLUMNS = {
  active: [
    { key: 'channel', label: '触点渠道', align: 'left', width: 110 },
    { key: 'strategyCount', label: '策略量', sortable: true, qoqField: 'strategyCountQoQ' },
    { key: 'pushCount', label: '推送量', sortable: true, qoqField: 'pushCountQoQ' },
    { key: 'usageCount', label: '使用量', sortable: true, qoqField: 'usageCountQoQ' },
    { key: 'usageRate', label: '使用率', sortable: true, qoqField: 'usageRateQoQ' },
    { key: 'reachCount', label: '触达量', sortable: true, qoqField: 'reachCountQoQ' },
    { key: 'targetConvNum', label: '目标转化量', sortable: true, qoqField: 'targetConvNumQoQ' },
    { key: 'targetConvRate', label: '目标转化率', sortable: true, qoqField: 'targetConvRateQoQ' },
    { key: 'productConvNum', label: '全产品转化量', sortable: true, qoqField: 'productConvNumQoQ' },
    { key: 'productConvRate', label: '全产品转化率', sortable: true, qoqField: 'productConvRateQoQ' },
    { key: 'actualIncome', label: '实际收入(元)', sortable: true, qoqField: 'actualIncomeQoQ' }
  ],
  passive: [
    { key: 'channel', label: '触点渠道', align: 'left', width: 110 },
    { key: 'strategyCount', label: '策略量', sortable: true, qoqField: 'strategyCountQoQ' },
    { key: 'pushCount', label: '推送量', sortable: true, qoqField: 'pushCountQoQ' },
    { key: 'usageCount', label: '使用量', sortable: true, qoqField: 'usageCountQoQ' },
    { key: 'usageRate', label: '使用率', sortable: true, qoqField: 'usageRateQoQ' },
    { key: 'reachCount', label: '触达量', sortable: true, qoqField: 'reachCountQoQ' },
    { key: 'targetConvNum', label: '目标转化量', sortable: true, qoqField: 'targetConvNumQoQ' },
    { key: 'targetConvRate', label: '目标转化率', sortable: true, qoqField: 'targetConvRateQoQ' },
    { key: 'productConvNum', label: '全产品转化量', sortable: true, qoqField: 'productConvNumQoQ' },
    { key: 'productConvRate', label: '全产品转化率', sortable: true, qoqField: 'productConvRateQoQ' },
    { key: 'actualIncome', label: '实际收入(元)', sortable: true, qoqField: 'actualIncomeQoQ' }
  ],
  control: [
    { key: 'channel', label: '触点渠道', align: 'left', width: 110 },
    { key: 'strategyCount', label: '策略量', sortable: true, qoqField: 'strategyCountQoQ' },
    { key: 'consultCount', label: '咨询量', sortable: true, qoqField: 'consultCountQoQ' },
    { key: 'retainCount', label: '挽留量', sortable: true, qoqField: 'retainCountQoQ' },
    { key: 'retainRate', label: '挽留率', sortable: true, qoqField: 'retainRateQoQ' },
    { key: 'successCount', label: '成功量', sortable: true, qoqField: 'successCountQoQ' },
    { key: 'successRate', label: '成功率', sortable: true, qoqField: 'successRateQoQ' },
    { key: 'income', label: '收入(元)', sortable: true, qoqField: 'incomeQoQ' }
  ]
}

// 主动/被动 tab 右侧列结构相同（仅数据语义不同），合并定义
// 含策略大类/小类列，支持点击联动下方触点产能趋势/业务产能明细/策略执行情况
const RIGHT_COLUMNS_ACTIVE_PASSIVE = [
  { key: 'channel', label: '渠道', align: 'left', width: 100 },
  { key: 'bigCategory', label: '策略大类', align: 'left', width: 100, isCategory: true },
  { key: 'smallCategory', label: '策略小类', align: 'left', width: 100, isCategory: true },
  { key: 'name', label: '策略名称', align: 'left', width: 130 },
  { key: 'pushCount', label: '推送量', sortable: true, qoqField: 'pushCountQoQ' },
  { key: 'usageCount', label: '使用量', sortable: true, qoqField: 'usageCountQoQ' },
  { key: 'usageRate', label: '使用率', sortable: true, qoqField: 'usageRateQoQ' },
  { key: 'reachCount', label: '触达量', sortable: true, qoqField: 'reachCountQoQ' },
  { key: 'targetConvNum', label: '目标转化量', sortable: true, qoqField: 'targetConvNumQoQ' },
  { key: 'targetConvRate', label: '目标转化率', sortable: true, qoqField: 'targetConvRateQoQ' },
  { key: 'productConvNum', label: '全产品转化量', sortable: true, qoqField: 'productConvNumQoQ' },
  { key: 'productConvRate', label: '全产品转化率', sortable: true, qoqField: 'productConvRateQoQ' },
  { key: 'actualIncome', label: '实际收入(元)', sortable: true, qoqField: 'actualIncomeQoQ' }
]

const RIGHT_COLUMNS = {
  active: RIGHT_COLUMNS_ACTIVE_PASSIVE,
  passive: RIGHT_COLUMNS_ACTIVE_PASSIVE,
  // control 去掉策略名称列，改为场景大类 + 场景小类
  control: [
    { key: 'channel', label: '渠道', align: 'left', width: 100 },
    { key: 'bigCategory', label: '场景大类', align: 'left', width: 100, isCategory: true },
    { key: 'smallCategory', label: '场景小类', align: 'left', width: 100, isCategory: true },
    { key: 'consultCount', label: '咨询量', sortable: true, qoqField: 'consultCountQoQ' },
    { key: 'retainCount', label: '挽留量', sortable: true, qoqField: 'retainCountQoQ' },
    { key: 'retainRate', label: '挽留率', sortable: true, qoqField: 'retainRateQoQ' },
    { key: 'successCount', label: '成功量', sortable: true, qoqField: 'successCountQoQ' },
    { key: 'successRate', label: '成功率', sortable: true, qoqField: 'successRateQoQ' },
    { key: 'income', label: '收入(元)', sortable: true, qoqField: 'incomeQoQ' }
  ]
}

// 策略分类执行情况列定义（不展示策略名称，仅按大类+小类聚合展示指标）
const CATEGORY_COLUMNS_ACTIVE_PASSIVE = [
  { key: 'strategyCount', label: '策略量', sortable: true, qoqField: 'strategyCountQoQ' },
  { key: 'pushCount', label: '推送量', sortable: true, qoqField: 'pushCountQoQ' },
  { key: 'usageCount', label: '使用量', sortable: true, qoqField: 'usageCountQoQ' },
  { key: 'usageRate', label: '使用率', sortable: true, qoqField: 'usageRateQoQ' },
  { key: 'reachCount', label: '触达量', sortable: true, qoqField: 'reachCountQoQ' },
  { key: 'targetConvNum', label: '目标转化量', sortable: true, qoqField: 'targetConvNumQoQ' },
  { key: 'targetConvRate', label: '目标转化率', sortable: true, qoqField: 'targetConvRateQoQ' },
  { key: 'productConvNum', label: '全产品转化量', sortable: true, qoqField: 'productConvNumQoQ' },
  { key: 'productConvRate', label: '全产品转化率', sortable: true, qoqField: 'productConvRateQoQ' },
  { key: 'actualIncome', label: '实际收入(元)', sortable: true, qoqField: 'actualIncomeQoQ' }
]

const CATEGORY_COLUMNS = {
  active: CATEGORY_COLUMNS_ACTIVE_PASSIVE,
  passive: CATEGORY_COLUMNS_ACTIVE_PASSIVE,
  control: [
    { key: 'strategyCount', label: '策略量', sortable: true, qoqField: 'strategyCountQoQ' },
    { key: 'consultCount', label: '咨询量', sortable: true, qoqField: 'consultCountQoQ' },
    { key: 'retainCount', label: '挽留量', sortable: true, qoqField: 'retainCountQoQ' },
    { key: 'retainRate', label: '挽留率', sortable: true, qoqField: 'retainRateQoQ' },
    { key: 'dispatchCount', label: '派单量', sortable: true, qoqField: 'dispatchCountQoQ' },
    { key: 'successCount', label: '成功量', sortable: true, qoqField: 'successCountQoQ' },
    { key: 'successRate', label: '成功率', sortable: true, qoqField: 'successRateQoQ' },
    { key: 'income', label: '收入(元)', sortable: true, qoqField: 'incomeQoQ' }
  ]
}

export default {
  name: 'TouchpointExecution',
  components: { EChart },
  props: {
    tabType: { type: String, default: 'active' },
    dateRange: { type: Array, default: () => [] },
    activeStrategy: { type: Object, default: () => ({ name: null, channel: null }) },
    favStrategies: { type: Array, default: () => [] }
  },
  data () {
    return {
      leftLoading: false,
      rightLoading: false,
      favLoading: false,
      leftTableData: [],
      leftTotalRow: {},
      rightTableData: [],
      rightTotal: 0,
      rightPage: 1,
      rightPageSize: 5,
      rightSelected: [],
      rightFilter: { channel: '', strategyName: '', month: '', bigCategory: '', smallCategory: '' },
      rightSort: { field: 'productConvNum', dir: 'desc' },
      leftSort: { field: 'productConvNum', dir: 'desc' },
      channelOptions: [],
      // 触点联动（产能趋势 + 业务产能明细）
      activeChannel: '',
      channelTrendLoading: false,
      channelBizLoading: false,
      channelTrendMonths: [],
      channelTrendValues: [],
      channelTrendQoq: [],
      channelBizList: [],
      // 策略分类执行情况
      categoryTableData: [],
      categoryTotalRow: {},
      categoryLoading: false,
      categorySort: { field: 'productConvNum', dir: 'desc' },
      categoryPage: 1,
      categoryPageSize: 5,
      categoryFilter: { bigCategory: '', smallCategory: '', channel: '全部', month: '' },
      // 大类/小类联动筛选
      activeBigCategory: '',
      activeSmallCategory: '',
      // 全屏弹窗
      showCategoryFullscreen: false,
      showRightFullscreen: false,
      categoryFullscreenHeight: 600,
      rightFullscreenHeight: 600,
      bizTableH: 200
    }
  },
  computed: {
    leftColumns () { return LEFT_COLUMNS[this.tabType] || LEFT_COLUMNS.active },
    leftTableDataWithTotal () {
      const rows = [...this.leftTableData]
      const total = this.leftTotalRow
      if (total && Object.keys(total).length) {
        rows.push({ ...total, channel: '合计', _isTotal: true })
      }
      return rows
    },
    rightColumns () { return RIGHT_COLUMNS[this.tabType] || RIGHT_COLUMNS.active },
    categoryColumns () { return CATEGORY_COLUMNS[this.tabType] || CATEGORY_COLUMNS.active },
    categoryAllDataWithTotal () {
      const rows = [...this.categoryTableData]
      const total = this.categoryTotalRow
      if (total && Object.keys(total).length) {
        rows.push({ ...total, bigCategory: '合计', smallCategory: '', _isTotal: true })
      }
      return rows
    },
    categoryTableDataWithTotal () {
      const all = this.categoryTableData
      const total = this.categoryTotalRow
      const hasTotal = total && Object.keys(total).length
      const page = this.categoryPage
      const size = this.categoryPageSize
      const totalPages = Math.max(1, Math.ceil(all.length / size))
      const start = (page - 1) * size
      const pageRows = all.slice(start, start + size)
      if (hasTotal && page === totalPages) {
        pageRows.push({ ...total, bigCategory: '合计', smallCategory: '', _isTotal: true })
      }
      return pageRows
    },
    categoryTotalCount () {
      return this.categoryTableData.length
    },
    isControl () { return this.tabType === 'control' },
    bigCategoryOptions () {
      const set = new Set()
      this.categoryTableData.forEach(r => r.bigCategory && set.add(r.bigCategory))
      return Array.from(set)
    },
    smallCategoryOptions () {
      const set = new Set()
      this.categoryTableData.forEach(r => {
        if (!this.categoryFilter.bigCategory || r.bigCategory === this.categoryFilter.bigCategory) {
          r.smallCategory && set.add(r.smallCategory)
        }
      })
      return Array.from(set)
    },
    // 策略执行情况全屏筛选栏专用：小类选项跟随全屏筛选栏自己选中的大类
    rightSmallCategoryOptions () {
      const set = new Set()
      this.categoryTableData.forEach(r => {
        if (!this.rightFilter.bigCategory || r.bigCategory === this.rightFilter.bigCategory) {
          r.smallCategory && set.add(r.smallCategory)
        }
      })
      return Array.from(set)
    },
    // 当前选中渠道的显示名称：空为全部渠道，否则取中文名
    activeChannelLabel () {
      if (!this.activeChannel) return '全部渠道'
      const opt = this.channelOptions.find(c => c.value === this.activeChannel)
      return opt ? opt.label : this.activeChannel
    },
    channelChartOption () {
      const points = chartRows(this.channelTrendMonths, this.channelTrendValues, this.channelTrendQoq)
      const months = points.months
      const values = points.values
      const qoq = points.comparison
      if (!months.length) {
        return {
          title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#9ca3af', fontSize: 13, fontWeight: 400 } },
          series: []
        }
      }
      const maxQoQ = Math.max(...(qoq.map(v => Math.abs(Number(v) || 0))), 1)
      const yAxisMax = Math.max(20, Math.ceil(maxQoQ * 1.2))
      return {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          textStyle: { color: '#374151', fontSize: 12 },
          axisPointer: { type: 'cross', crossStyle: { color: '#9ca3af' } },
          formatter: (params) => {
            let html = `<div style="font-weight:500;margin-bottom:4px;">${params[0].axisValue}</div>`
            params.forEach(p => {
              const val = p.seriesName === '环比' ? (p.value != null ? p.value + '%' : '--') : p.value
              html += `<div style="display:flex;justify-content:space-between;gap:16px;"><span>${p.marker}${p.seriesName}</span><span style="font-weight:600;">${val}</span></div>`
            })
            return html
          }
        },
        legend: { show: false },
        grid: { left: 36, right: 44, bottom: 20, top: 10, containLabel: false },
        xAxis: {
          type: 'category',
          data: months,
          axisLine: { lineStyle: { color: '#e5e7eb' } },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisTick: { show: false }
        },
        yAxis: [
          {
            type: 'value',
            axisLine: { show: false },
            axisLabel: { color: '#9ca3af', fontSize: 10 },
            splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }
          },
          {
            type: 'value',
            name: '环比',
            nameTextStyle: { color: '#9ca3af', fontSize: 10, padding: [0, 0, 0, 10] },
            axisLine: { show: false },
            axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value}%' },
            splitLine: { show: false },
            min: -yAxisMax,
            max: yAxisMax
          }
        ],
        series: [
          {
            name: '产能',
            type: 'bar',
            data: values,
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#60a5fa' },
                  { offset: 1, color: '#2563eb' }
                ]
              },
              borderRadius: [3, 3, 0, 0]
            },
            barWidth: '45%'
          },
          {
            name: '环比',
            type: 'line',
            yAxisIndex: 1,
            data: qoq,
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { color: '#f59e0b', width: 2 },
            itemStyle: { color: '#f59e0b', borderWidth: 2, borderColor: '#fff' },
            label: {
              formatter: (p) => p.value == null ? '' : (p.value >= 0 ? '+' : '') + p.value + '%'
            }
          }
        ]
      }
    },
    // 无独立月份控件的表格使用的默认账期月（取全局日期范围起始月 yyyy-MM）
    // 注意：必须是 computed——之前误放在 methods 里，this.defaultStatMonth 取到函数，
    // axios JSON 序列化时整个 statMonth 键被丢弃，导致 categorySummary 等接口查空
    defaultStatMonth () {
      const [startDate] = this.dateRange || []
      return (startDate || '').slice(0, 7)
    }
  },
  watch: {
    tabType () {
      this.rightPage = 1
      this.rightFilter = { channel: '', strategyName: '', month: '', bigCategory: '', smallCategory: '' }
      this.activeChannel = ''
      this.channelTrendMonths = []
      this.channelTrendValues = []
      this.channelTrendQoq = []
      this.channelBizList = []
      this.activeBigCategory = ''
      this.activeSmallCategory = ''
      this.categorySort = { field: 'productConvNum', dir: 'desc' }
      this.fetchLeftData()
      this.fetchCategoryData()
      // tab 切换时，直接获取列表并自动选中第一条
      // 不依赖 activeStrategy prop 的状态判断
      this.fetchRightDataAndAutoSelect()
      this.fetchChannelDim()
    },
    dateRange () {
      this.fetchLeftData()
      this.fetchCategoryData()
      this.fetchRightData()
      if (this.activeChannel) {
        this.fetchChannelTrendData()
        this.fetchChannelBizData()
      }
    },
    showCategoryFullscreen (val) {
      if (val) {
        this.calcFullscreenHeight()
        window.addEventListener('resize', this.calcFullscreenHeight)
      } else {
        window.removeEventListener('resize', this.calcFullscreenHeight)
      }
    },
    showRightFullscreen (val) {
      if (val) {
        this.calcFullscreenHeight()
        window.addEventListener('resize', this.calcFullscreenHeight)
        // 打开全屏时沿用主界面已选中的大类/小类（全屏保留原筛选条件）
        this.rightFilter.bigCategory = this.activeBigCategory || ''
        this.rightFilter.smallCategory = this.activeSmallCategory || ''
        // 全屏时请求全部数据
        this.fetchRightDataFullscreen()
      } else {
        window.removeEventListener('resize', this.calcFullscreenHeight)
      }
    }
  },
  mounted () {
    this.fetchChannelDim()
    this.fetchLeftData()
    this.fetchCategoryData()
    this.fetchRightData()
    this.$nextTick(() => this.calcBottomHeights())
    window.addEventListener('resize', this.calcBottomHeights)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.calcFullscreenHeight)
    window.removeEventListener('resize', this.calcBottomHeights)
  },
  methods: {
    calcBottomHeights () {
      this.$nextTick(() => {
        const bizWrap = this.$refs.bizTableWrap
        if (bizWrap) {
          this.bizTableH = Math.max(bizWrap.offsetHeight, 80)
        }
      })
    },
    calcFullscreenHeight () {
      const h = window.innerHeight - 120
      this.categoryFullscreenHeight = h
      this.rightFullscreenHeight = h - 60
    },
    channelStyle (channel) {
      const m = CHANNEL_COLOR_MAP[channel] || { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }
      return { color: m.color, background: m.bg, borderColor: m.color }
    },
    // 优先显示接口返回的渠道名称，没有名称时回退显示原始渠道值。
    getChannelLabel (row) {
      const name = row.channelName || row.keyName
      if (name) return name
      return row.channel || row.channelCode || ''
    },
    buildParams (extra) {
      return {
        tabType: this.tabType,
        // 登录身份透传：后端按 city_id/user_id 过滤
        cityId: getCityId(),
        userId: getUserId(),
        ...(extra || {})
      }
    },
    async fetchChannelDim () {
      try {
        const res = await getDim({ type: '触点渠道', tabType: this.tabType })
        const list = extractList(res)
        this.channelOptions = list.map(c => ({
          label: c.keyName || c.channelName || c.name || c.label || c.channel,
          value: c.keyName || c.channelName || c.name || c.label || c.channel
        }))
      } catch (e) {
        this.channelOptions = []
      }
    },
    async fetchLeftData () {
      this.leftLoading = true
      try {
        const res = await getChannelSummary(this.buildParams({
          channel: this.activeChannel || '',
          statMonth: this.defaultStatMonth,
          sortField: this.leftSort.field,
          sortDir: this.leftSort.dir
        }))
        this.leftTableData = extractList(res)
        this.leftTotalRow = extractTotalRow(res)
        // 默认不选中任何渠道（即“全部渠道”），首次加载主动加载右侧/趋势数据
        this.fetchRightData()
        this.fetchCategoryData()
        this.fetchChannelTrendData()
        this.fetchChannelBizData()
      } catch (e) {
        console.error('[TouchpointExecution] getChannelSummary error:', e)
        this.leftTableData = []
        this.leftTotalRow = {}
        this.channelTrendMonths = []
        this.channelTrendValues = []
        this.channelTrendQoq = []
        this.channelBizList = []
      } finally {
        this.leftLoading = false
        this.$nextTick(() => this.calcBottomHeights())
      }
    },
    async fetchRightData () {
      this.rightLoading = true
      try {
        const res = await getStrategyList(this.buildParams({
          channel: this.rightFilter.channel || '',
          bigCategory: this.activeBigCategory || '',
          smallCategory: this.activeSmallCategory || '',
          strategyName: this.rightFilter.strategyName || '',
          statMonth: this.rightFilter.month || this.defaultStatMonth,
          pageNum: this.rightPage,
          pageSize: this.rightPageSize,
          sortField: this.rightSort.field,
          sortDir: this.rightSort.dir
        }))
        const list = extractList(res)
        this.rightTableData = list
        this.rightTotal = extractTotal(res, list)
        // 未选中策略时自动选中第一条，联动加载下方策略执行详情/执行明细
        if (list.length > 0 && !this.activeStrategy.strategyId && !this.activeStrategy.name) {
          const first = list[0]
          this.$emit('strategyClick', {
            strategyId: first.strategyId || first.id || first.strategyCode || first.code || null,
            name: first.strategyName || first.name,
            channel: first.channel,
            auto: true
          })
        }
      } catch (e) {
        console.error('[TouchpointExecution] getStrategyList error:', e)
        this.rightTableData = []
        this.rightTotal = 0
      } finally {
        this.rightLoading = false
      }
    },
    // tab 切换时专用：获取列表并自动选中第一条（不依赖 activeStrategy prop 状态）
    async fetchRightDataAndAutoSelect () {
      this.rightLoading = true
      try {
        const res = await getStrategyList(this.buildParams({
          channel: this.rightFilter.channel || '',
          bigCategory: this.activeBigCategory || '',
          smallCategory: this.activeSmallCategory || '',
          strategyName: this.rightFilter.strategyName || '',
          statMonth: this.rightFilter.month || this.defaultStatMonth,
          pageNum: this.rightPage,
          pageSize: this.rightPageSize,
          sortField: this.rightSort.field,
          sortDir: this.rightSort.dir
        }))
        const list = extractList(res)
        this.rightTableData = list
        this.rightTotal = extractTotal(res, list)
        // tab 切换时，直接选中第一条策略（不检查 activeStrategy 状态）
        if (list.length > 0) {
          const first = list[0]
          this.$emit('strategyClick', {
            strategyId: first.strategyId || first.id || first.strategyCode || first.code || null,
            name: first.strategyName || first.name,
            channel: first.channel,
            auto: true
          })
        }
      } catch (e) {
        console.error('[TouchpointExecution] getStrategyList error:', e)
        this.rightTableData = []
        this.rightTotal = 0
      } finally {
        this.rightLoading = false
      }
    },
    // 全屏时获取全部数据（不分页）
    async fetchRightDataFullscreen () {
      this.rightLoading = true
      try {
        const res = await getStrategyList(this.buildParams({
          channel: this.rightFilter.channel || '',
          bigCategory: this.rightFilter.bigCategory || '',
          smallCategory: this.rightFilter.smallCategory || '',
          strategyName: this.rightFilter.strategyName || '',
          statMonth: this.rightFilter.month || this.defaultStatMonth,
          pageNum: 1,
          pageSize: 9999,
          sortField: this.rightSort.field,
          sortDir: this.rightSort.dir
        }))
        this.rightTableData = extractList(res)
        this.rightTotal = extractTotal(res, this.rightTableData)
      } catch (e) {
        console.error('[TouchpointExecution] getStrategyList(fullscreen) error:', e)
      } finally {
        this.rightLoading = false
      }
    },
    // 策略分类执行情况（按大类+小类聚合，不展示策略名称）
    async fetchCategoryData () {
      this.categoryLoading = true
      try {
        const res = await getCategorySummary(this.buildParams({
          // 筛选栏选中的月份/触点渠道（搜索按钮触发）
          statMonth: this.categoryFilter.month || this.defaultStatMonth,
          channel: this.categoryFilter.channel || this.activeChannel || '',
          bigCategory: this.categoryFilter.bigCategory || this.bigCategory,
          smallCategory: this.categoryFilter.smallCategory || this.smallCategory,
          sortField: this.categorySort.field,
          sortDir: this.categorySort.dir
        }))
        this.categoryTableData = extractList(res)
        this.categoryTotalRow = extractTotalRow(res)
      } catch (e) {
        console.error('[TouchpointExecution] getCategorySummary error:', e)
        this.categoryTableData = []
        this.categoryTotalRow = {}
      } finally {
        this.categoryLoading = false
      }
    },
    handleCategorySort ({ prop, order }) {
      if (!prop || !order) return
      this.categorySort = { field: prop, dir: order === 'ascending' ? 'asc' : 'desc' }
      this.categoryPage = 1
      this.fetchCategoryData()
    },
    // 点击大类/小类联动：再次点击同一值取消
    handleBigClick (cat) {
      if (this.activeBigCategory === cat) {
        this.activeBigCategory = ''
        this.activeSmallCategory = ''
      } else {
        this.activeBigCategory = cat
      }
      this.rightPage = 1
      this.fetchRightData()
      this.fetchChannelTrendData()
      this.fetchChannelBizData()
    },
    handleSmallClick (cat) {
      if (!this.activeBigCategory) return
      this.activeSmallCategory = this.activeSmallCategory === cat ? '' : cat
      this.rightPage = 1
      this.fetchRightData()
      this.fetchChannelTrendData()
      this.fetchChannelBizData()
    },
    // 右侧策略明细表格内的大类/小类单元格点击
    handleCategoryCellClick (key, val) {
      if (!val) return
      if (key === 'bigCategory') this.handleBigClick(val)
      else if (key === 'smallCategory') this.handleSmallClick(val)
    },
    clearCategoryFilter () {
      this.activeBigCategory = ''
      this.activeSmallCategory = ''
      this.rightPage = 1
      this.fetchRightData()
      this.fetchChannelTrendData()
      this.fetchChannelBizData()
    },
    categoryRowClass ({ row }) {
      return (row.bigCategory === this.activeBigCategory && row.smallCategory === this.activeSmallCategory)
        ? 'row-active' : ''
    },
    handleLeftSort ({ prop, order }) {
      if (!prop || !order) return
      this.leftSort = { field: prop, dir: order === 'ascending' ? 'asc' : 'desc' }
      this.fetchLeftData()
    },
    handleRightSort ({ prop, order }) {
      if (!prop || !order) return
      this.rightSort = { field: prop, dir: order === 'ascending' ? 'asc' : 'desc' }
      this.rightPage = 1
      this.fetchRightData()
    },
    handleRightSizeChange (size) {
      this.rightPageSize = size
      this.rightPage = 1
      this.fetchRightData()
    },
    handleRightSelectionChange (rows) { this.rightSelected = rows || [] },
    // 行点击：触发右侧策略筛选 + 触点联动（趋势图+业务明细）
    handleLeftRowClick (row) {
      if (row._isTotal) return
      this.selectChannel(row.channelName || row.channel)
    },
    selectChannel (channel) {
      this.rightFilter.channel = channel
      this.categoryFilter.channel = channel
      this.activeChannel = channel
      this.rightPage = 1
      this.fetchRightData()
      this.fetchCategoryData()
      this.fetchChannelTrendData()
      this.fetchChannelBizData()
    },
    async fetchChannelTrendData () {
      this.channelTrendLoading = true
      try {
        const res = await getChannelCapacityTrend(this.buildParams({
          channel: this.activeChannel,
          bigCategory: this.activeBigCategory || '',
          smallCategory: this.activeSmallCategory || '',
          statMonth: this.categoryFilter.month || this.defaultStatMonth
        }))
        if (res && Array.isArray(res.months) && res.months.length > 0) {
          this.channelTrendMonths = res.months
          this.channelTrendValues = res.values || res.capacity || []
          this.channelTrendQoq = res.qoq || res.mom || []
        } else {
          const list = extractList(res)
          if (list.length === 0) {
            this.channelTrendMonths = []
            this.channelTrendValues = []
            this.channelTrendQoq = []
          } else {
            const sorted = [...list]
            this.channelTrendMonths = sorted.map(item => item.monthLabel || item.statMonth)
            this.channelTrendValues = sorted.map(item => item.capacity)
            this.channelTrendQoq = sorted.map(item => item.qoq)
          }
        }
      } catch (e) {
        console.error('[TouchpointExecution] getChannelCapacityTrend error:', e)
        this.channelTrendMonths = []
        this.channelTrendValues = []
        this.channelTrendQoq = []
      } finally {
        this.channelTrendLoading = false
      }
    },
    async fetchChannelBizData () {
      this.channelBizLoading = true
      try {
        const res = await getChannelBizCapacity(this.buildParams({
          channel: this.activeChannel || '全部',
          bigCategory: this.activeBigCategory || '',
          smallCategory: this.activeSmallCategory || '',
          statMonth: this.categoryFilter.month || this.defaultStatMonth
        }))
        this.channelBizList = extractList(res)
      } catch (e) {
        console.error('[TouchpointExecution] getChannelBizCapacity error:', e)
        this.channelBizList = []
      } finally {
        this.channelBizLoading = false
      }
    },
    handleRightRowClick (row) {
      const strategyId = row.strategyId || row.id || row.strategyCode || row.code || null
      this.$emit('strategyClick', {
        strategyId: strategyId,
        name: row.strategyName || row.name,
        channel: row.channel
      })
    },
    leftRowClass ({ row }) {
      if (row._isTotal) return 'row-total'
      return (row.channelName || row.channel) === this.activeChannel ? 'row-active' : ''
    },
    rightRowClass ({ row }) {
      const name = row.strategyName || row.name
      return (name === this.activeStrategy.name && row.channel === this.activeStrategy.channel) ? 'row-active' : ''
    },
    // 收藏：把当前选中策略加入收藏
    handleAddFavorite () {
      if (!this.rightSelected.length) {
        this.$message.warning('请先勾选要收藏的策略')
        return
      }
      const list = this.rightSelected.map(r => (r.strategyId))
      this.favLoading = true
      console.info(this.buildParams({ strategyIds: list }))
      addFavorite(this.buildParams({ strategyIds: list })).then(res => {
        this.$message.success(`已加入收藏 ${list.length} 条`)
        this.$emit('favAdd', list)
      }).catch(err => {
        this.$message.error('收藏失败：' + (err.message || '请稍后重试'))
      }).finally(() => {
        this.favLoading = false
      })
    },
    // 千分位格式化：推送量、收入等大数字便于阅读；比率/字符串原样返回
    // 兼容两种调用：el-table :formatter 传 (row, column, cellValue)，模板直传单值
    formatNum (row, column, cellValue) {
      const value = arguments.length >= 3 ? cellValue : row
      const field = arguments.length >= 3 && column && typeof column === 'object' ? column.property : column
      if (value === null || value === undefined || value === '') return '--'
      const num = Number(value)
      if (Number.isNaN(num)) return value
      if (field === 'strategyCount') return integerText(value)
      // 保留最多2位小数，整数部分千分位
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
    },
    handleLeftExport () {
      const columns = this.leftColumns.map(col => {
        if (col.qoqField) {
          return {
            label: col.label,
            formatter: (row) => {
              const val = row[col.key]
              const qoq = row[col.qoqField]
              if (qoq == null) return val != null ? this.formatNum(val, col.key) : ''
              const sign = qoq >= 0 ? '+' : ''
              return `${val != null ? this.formatNum(val, col.key) : ''} (${sign}${qoq.toFixed(1)}%)`
            }
          }
        }
        return { label: col.label, prop: col.key }
      })
      const data = [...this.leftTableData]
      if (this.leftTotalRow && Object.keys(this.leftTotalRow).length) {
        data.push({ ...this.leftTotalRow, channel: '合计' })
      }
      exportTableToCsv({
        columns,
        data,
        filename: `渠道汇总_${this.tabType}`
      })
    },
    handleRightExport () {
      const data = this.rightSelected.length > 0 ? this.rightSelected : this.rightTableData
      const columns = this.rightColumns.map(col => {
        if (col.qoqField) {
          return {
            label: col.label,
            formatter: (row) => {
              const val = row[col.key]
              const qoq = row[col.qoqField]
              if (qoq == null) return val != null ? this.formatNum(val, col.key) : ''
              const sign = qoq >= 0 ? '+' : ''
              return `${val != null ? this.formatNum(val, col.key) : ''} (${sign}${qoq.toFixed(1)}%)`
            }
          }
        }
        return { label: col.label, prop: col.key }
      })
      exportTableToCsv({
        columns,
        data,
        filename: `策略明细_${this.tabType}`
      })
    },
    // 策略分类执行情况导出（含大类/小类列，不含策略名称）
    handleCategoryExport () {
      const data = this.categoryTableData
      if (!data.length) {
        this.$message.warning('暂无数据可导出')
        return
      }
      const bigLabel = this.isControl ? '场景大类' : '策略大类'
      const smallLabel = this.isControl ? '场景小类' : '策略小类'
      const columns = [
        { label: bigLabel, prop: 'bigCategory' },
        { label: smallLabel, prop: 'smallCategory' },
        ...this.categoryColumns.map(col => {
          if (col.qoqField) {
            return {
              label: col.label,
              formatter: (row) => {
                const val = row[col.key]
                const qoq = row[col.qoqField]
                if (qoq == null) return val != null ? this.formatNum(val, col.key) : ''
                const sign = qoq >= 0 ? '+' : ''
                return `${val != null ? this.formatNum(val, col.key) : ''} (${sign}${qoq.toFixed(1)}%)`
              }
            }
          }
          return { label: col.label, prop: col.key }
        })
      ]
      exportTableToCsv({
        columns,
        data,
        filename: `策略分类执行情况_${this.tabType}`
      })
    },
    handleCategorySearch () {
      this.categoryPage = 1
      this.fetchCategoryData()
    },
    onBigCategoryChange () {
      this.categoryFilter.smallCategory = ''
    },
    handleCategoryReset () {
      this.categoryFilter = { bigCategory: '', smallCategory: '', channel: '全部', month: '' }
      this.categoryPage = 1
      this.fetchCategoryData()
    },
    handleRightSearch () {
      this.rightPage = 1
      // 全屏弹窗内搜索走全量查询（不分页），主界面走分页查询
      if (this.showRightFullscreen) {
        this.fetchRightDataFullscreen()
      } else {
        this.fetchRightData()
      }
    },
    handleRightReset () {
      this.rightFilter = { channel: '', strategyName: '', month: '', bigCategory: '', smallCategory: '' }
      this.rightPage = 1
      if (this.showRightFullscreen) {
        this.fetchRightDataFullscreen()
      } else {
        this.fetchRightData()
      }
    },
    handleRightSizeChange (size) {
      this.rightPageSize = size
      this.rightPage = 1
      this.fetchRightData()
    },
    handleRightSelectionChange (val) {
      this.rightSelected = val
    },
    clearStrategyFilter () {
      this.$emit('strategyClick', { name: null, channel: null })
    },
    categoryRowClass ({ row }) {
      if (row._isTotal) return 'row-total'
      if (this.activeSmallCategory && row.smallCategory === this.activeSmallCategory) return 'row-active'
      if (this.activeBigCategory && !this.activeSmallCategory && row.bigCategory === this.activeBigCategory) return 'row-active-light'
      return ''
    }
  }
}
</script>

<style lang="less" scoped>
@import '../styles/index.less';

.touchpoint-section {
  background: #fff;
  border-radius: 6px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    .card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      .card-title-dot {
        width: 3px;
        height: 12px;
        background: #2563eb;
        border-radius: 2px;
      }
    }
  }
  .card-body { padding: 8px 12px; }
  .grid-two-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
  }
  // 表格统一圆角（含边框伪元素，避免直角边框线戳出圆角）
  /deep/ .el-table {
    border-radius: 6px;
    overflow: hidden;
    &.el-table--border::after {
      border-radius: 6px;
    }
  }
  .left-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    // 水平内边距：避免导出按钮/表格紧贴栅格间隙与页面边缘，与右侧面板对称（10+10+gap10=30px 视觉间距）
    padding: 0 10px;
    /deep/ .el-table {
      flex-shrink: 0;
    }
  }
  .right-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0 10px;
    /deep/ .el-table {
      flex-shrink: 0;
    }
  }
  // 左右上块统一高度与节奏：分界线（虚线）水平对齐，表格弹性填充
  // 注意：margin-bottom 固定为 0，下块间距由各下块自己的 margin-top 提供，保证左右下块起点严格相同
  .top-block {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 280px;
    flex-shrink: 0;
    padding-bottom: 8px;
    margin-bottom: 0;
    border-bottom: 1px dashed #e5e7eb;
    /deep/ .el-table {
      flex: 1;
      min-height: 0;
      flex-shrink: 1;
    }
    .table-footer {
      flex-shrink: 0;
    }
  }
  .channel-bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    // 与右侧 .strategy-block 的 margin-top 保持一致，保证左右下块起点相同
    margin-top: 8px;
    flex: 1;
    min-height: 280px;
  }
  .channel-detail-card {
    background: #f9fafb;
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .trend-chart {
    flex: 1;
    min-height: 0;
  }
  .biz-table-inner {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .panel-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    // 固定行高：保证左右面板标题文字处于同一水平线（左侧含导出按钮、右侧含面包屑时也不撑高）
    height: 24px;
    flex-shrink: 0;
    margin-bottom: 6px;
    .panel-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      .panel-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        &.blue { background: #2563eb; }
      }
    }
    .panel-filters {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .category-breadcrumb, .strategy-selected-tip {
      font-size: 11px;
      color: #6b7280;
      .tip-label { color: #6b7280; }
      .tip-value { color: #2563eb; font-weight: 500; margin: 0 4px; }
    }
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 6px;
    flex-wrap: wrap;
    flex-shrink: 0;
    /deep/ .el-input__inner, /deep/ .el-date-editor .el-input__inner {
      height: 24px;
      line-height: 24px;
      font-size: 11px;
    }
    /deep/ .el-button--mini {
      padding: 3px 8px;
      font-size: 11px;
    }
    // 文字按钮（全屏/导出/收藏）与 mini 按钮统一 24px 高度，图标+文字垂直居中，保证与搜索/重置水平对齐
    /deep/ .el-button--text {
      height: 24px;
      padding: 3px 0;
      margin-left: 8px;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      line-height: 18px;
    }
  }
  .channel-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    border: 1px solid;
    // 标签文字不换行，避免「中国移动APP」被拆成两行
    white-space: nowrap;
  }
  .strategy-name {
    cursor: pointer;
    color: #2563eb;
    &.strategy-active {
      font-weight: 600;
    }
    &:hover { text-decoration: underline; }
  }
  // 策略分类执行情况区块：布局节奏（高度/虚线分隔/间距）完全由 .top-block 统一提供
  .category-block {
    border-bottom: 1px dashed #e5e7eb;
  }
  // 与左侧 .footer-spacer 尺寸一致（24+4），保证左右表格底边/横向滚动条同线
  .footer-spacer {
    height: 24px;
    margin-top: 4px;
    flex-shrink: 0;
  }
  .table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    margin-top: 4px;
    flex-shrink: 0;
    overflow: hidden;
    font-size: 11px;
    color: #6b7280;
    &.pagination-only { justify-content: flex-end; }
  }
  .strategy-block {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    // 与左侧 .channel-bottom-grid 的 margin-top 一致；padding-top 与 .channel-detail-card 一致，
    // 保证「策略执行情况」标题与下方两张卡片标题严格同线
    margin-top: 8px;
    padding-top: 6px;
    /deep/ .el-table {
      flex: 1;
      min-height: 0;
      flex-shrink: 1;
    }
    .table-footer {
      flex-shrink: 0;
    }
  }
  .category-link {
    cursor: pointer;
    color: #2563eb;
    &:hover { text-decoration: underline; }
    &.active {
      background: #2563eb;
      color: #fff;
      padding: 1px 5px;
      border-radius: 3px;
    }
    &.disabled {
      cursor: not-allowed;
      color: #2563eb;
      pointer-events: none;
      opacity: 0.7;
      &:hover { text-decoration: none; }
    }
  }
  .cell-with-qoq {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.3;
    .qoq-badge {
      font-size: 10px;
      font-weight: 500;
      padding: 0 3px;
      &.up { color: #10b981; }
      &.down { color: #ef4444; }
    }
  }
  /deep/ .row-active { background: #eff6ff !important; }
  /deep/ .row-active-light { background: #f8fafc !important; }
  /deep/ .row-total {
    background: #f5f7fa !important;
    font-weight: 600;
    td { font-weight: 600; }
  }
  .total-label {
    font-weight: 700;
    color: #111827;
    font-size: 12px;
  }
  /deep/ .el-table--mini td, /deep/ .el-table--mini th {
    padding: 3px 0;
    font-size: 11px;
  }
  // 表头单元格不换行，保证排序按钮与文字同行显示
  /deep/ .el-table__header th .cell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /deep/ .el-table__row { cursor: pointer; }
  .detail-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    // 与 .panel-title-row 同高，保证下块卡片标题也处于同一水平线
    height: 24px;
    flex-shrink: 0;
    margin-bottom: 4px;
  }
  .detail-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    .detail-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      &.blue { background: #2563eb; }
    }
  }
  .detail-subtitle {
    font-size: 10px;
    color: #9ca3af;
  }
  .biz-total {
    text-align: right;
    margin-top: 3px;
    font-size: 10px;
    color: #9ca3af;
  }
  .chart-legend-mini {
    display: flex;
    gap: 10px;
    margin-bottom: 2px;
    font-size: 10px;
    color: #6b7280;
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-bar {
      width: 10px;
      height: 8px;
      border-radius: 2px;
    }
    .legend-line-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
  }
}
</style>

<style lang="less">
.table-fullscreen-dialog {
  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 16px 20px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .fullscreen-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    .fullscreen-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      .detail-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #2563eb;
      }
      .fullscreen-tag {
        padding: 2px 8px;
        background: #eff6ff;
        color: #2563eb;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
    }
    .fullscreen-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      .el-button--text {
        font-size: 14px;
        color: #6b7280;
        &:hover { color: #2563eb; }
      }
      .close-fullscreen-btn {
        margin-left: 8px;
        padding: 4px 12px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 13px;
        color: #6b7280;
        &:hover { border-color: #2563eb; color: #2563eb; }
      }
    }
  }
  // 全屏弹窗筛选栏（与主界面 filter-bar 保持一致，弹窗 append-to-body 需单独定义）
  .fullscreen-filter-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 10px;
    flex-wrap: wrap;
    flex-shrink: 0;
    .el-input__inner, .el-date-editor .el-input__inner {
      height: 24px;
      line-height: 24px;
      font-size: 11px;
    }
    .el-button--mini {
      padding: 3px 8px;
      font-size: 12px;
    }
  }
  // 全屏表格缩小字体、禁止横向滚动
  .el-table {
    font-size: 12px;
    th, th .cell {
      font-size: 11px;
      padding: 4px 0;
    }
    td .cell {
      font-size: 12px;
      padding: 2px 4px;
    }
    .el-table__body-wrapper {
      overflow-x: hidden !important;
    }
  }
}
</style>
