import * as React from 'react';

import OlLayerGroup from 'ol/layer/Group';

const _isEqual = require('lodash/isEqual');
const _groupBy = require('lodash/groupBy');
const _uniqueId = require('lodash/uniqueId');

import {
  Collapse
} from 'antd';
const Panel = Collapse.Panel;

import LayerTree from '@terrestris/react-geo/dist/LayerTree/LayerTree';
import Legend from '@terrestris/react-geo/dist/Legend/Legend';
import Titlebar from '@terrestris/react-geo/dist/Panel/Titlebar/Titlebar';

import {
  MapUtil
} from '@terrestris/ol-util';

import './LayerLegendAccordion.less';

import LayerLegendAccordionTreeNode from '../../LayerLegendAccordionTreeNode/LayerLegendAccordionTreeNode';

// default props
interface DefaultLayerLegendAccordionProps {
  title: string;
  treeNodeFilter: (layer: any, index: number, array: any[]) => any;
  extraLegensParams: Object;
  mapLayers: any[];
  baseLayer: any;
  revision: number;
  onTopicLayerDragEnd: () => void;
}

interface LayerLegendAccordionProps extends Partial<DefaultLayerLegendAccordionProps>{
  map: any;
  t: (arg: string) => {};
}

interface LayerLegendAccordionState {
  loadingQueue: string[];
  mainAccordionActiveKeys: string[];
  themeLayerActiveKeys: string[];
  baseLayerActiveKeys: string[];
}

/**
 * Class representing the LayerLegendAccordion.
 *
 * @class LayerLegendAccordion
 * @extends React.Component
 */
export default class LayerLegendAccordion extends React.Component<LayerLegendAccordionProps, LayerLegendAccordionState> {

  public static defaultProps: DefaultLayerLegendAccordionProps = {
    title: 'LayerTree',
    treeNodeFilter: () => true,
    extraLegensParams: {
      'LEGEND_OPTIONS': 'fontAntiAliasing:true;forceLabels:on;fontName:DejaVu Sans Condensed'
    },
    mapLayers: [],
    baseLayer: null,
    revision: 0,
    onTopicLayerDragEnd: () => { }
  };

  private _mapLayerGroup: any;
  private _baseLayerGroup: any;

  /**
   * Create the LayerLegendAccordion.
   *
   * @constructs LayerLegendAccordion
   */
  constructor(props: LayerLegendAccordionProps) {
    super(props);

    this.state = {
      loadingQueue: [],
      mainAccordionActiveKeys: ['tree', 'legend'],
      themeLayerActiveKeys: [],
      baseLayerActiveKeys: []
    };

    this._mapLayerGroup = new OlLayerGroup({
      layers: props.mapLayers
    });

    if (props.baseLayer) {
      this._baseLayerGroup = new OlLayerGroup({
        layers: [ props.baseLayer ]
      });
    }

    this.treeNodeTitleRenderer = this.treeNodeTitleRenderer.bind(this);
    this.getLegendItems = this.getLegendItems.bind(this);
    this.onAllLayersVisibleChange = this.onAllLayersVisibleChange.bind(this);
    this.onLayerLegendAccordionChange = this.onLayerLegendAccordionChange.bind(this);
    this.onThemeLayerAccordionChange = this.onThemeLayerAccordionChange.bind(this);
    this.onBaseLayerAccordionChange = this.onBaseLayerAccordionChange.bind(this);
  }

  /**
   * The componentDidUpdate lifecycle function
   *
   * @param prevProps
   * @param prevState
   */
  componentDidUpdate(prevProps: any, prevState: any) {
    if (!this.state.loadingQueue || !prevState.loadingQueue) {
      return;
    }
    if (!_isEqual(this.state.loadingQueue, prevState.loadingQueue)) {
      const groupingFn = (p: string) => `${p.split('_')[1]}-${p.indexOf('tile') > -1 ? 'tile' : 'image'}`;

      const prevGrouped = _groupBy(prevState.loadingQueue, groupingFn);
      const currentGrouped = _groupBy(this.state.loadingQueue, groupingFn);

      if (!_isEqual(Object.keys(prevGrouped), Object.keys(currentGrouped))) {
        this.props.map.dispatchEvent('moveend');
      }
    }
  }

  /**
   * Check if revision changed, if so: update private _mapLayerGroup
   * @param prevProps
   */
  getSnapshotBeforeUpdate(prevProps: any): null {
    if (!_isEqual(prevProps.revision, this.props.revision)) {
      if (this.props.mapLayers && this.props.mapLayers.length !== 0) {
        const layersCollection = this._mapLayerGroup.getLayers();
        layersCollection.clear();
        layersCollection.extend(this.props.mapLayers);
      }
      if (this.props.baseLayer) {
        const baseLayerCollection = this._baseLayerGroup.getLayers()
        baseLayerCollection.clear();
        baseLayerCollection.extend([this.props.baseLayer]);
      }
      this.forceUpdate();
      return null;
    }

    return null;
  }

  /**
   * Custom tree node renderer function containing:
   * * Eye symbol indicating layers visiblity
   * * Layer Name
   * * Loading indicator (spinning)
   * * Cog symbol to access layer's properties
   *
   * @param {OlLayer} layer The OpenLayers layer the tree node should be rendered for
   */
  treeNodeTitleRenderer(layer: any) {
    const {
      t
    } = this.props;

    return (
      <LayerLegendAccordionTreeNode
        t={t}
        layer={layer}
      />
    );
  }

  /**
   * Generate legend items for currently visible layers on map
   *
   * @returns {Collapse[]} An array of collapsible Instances of <Legend>
   */
  getLegendItems() {
    const {
      baseLayer,
      mapLayers,
      map,
      extraLegensParams
    } = this.props;
    if (!map || !mapLayers) {
      return null;
    }
    const unit = map.getView().getProjection().getUnits();
    const scale = MapUtil.getScaleForResolution(map.getView().getResolution(), unit);

    // clone the array, reverse will work in place
    const reversed = mapLayers.slice(0).reverse().filter((l: any) => l && l.getVisible());
    if (baseLayer) {
      reversed.push(baseLayer);
    }
    const legends = reversed.map((l: any) => {
      return (
        <Collapse
          key={_uniqueId('collapse-')}
          bordered={false}
          destroyInactivePanel={true}
        >
          <Panel
            key={_uniqueId('panel-')}
            header={l.get('name')}
          >
            <Legend
              key={l.getRevision()}
              layer={l}
              extraParams={{
                scale,
                WIDTH: 30 * 1.5,
                HEIGHT: 30,
                TRANSPARENT: true,
                ...extraLegensParams
              }}
            />
          </Panel>
        </Collapse>
      );
    });

    return (
      <div>
        {legends}
      </div>
    );
  }

  /**
   * Returns css class name for visibility class of all layers
   *
   * @param {OlLayer[]} layers The OpenLayers layers to get the class names for
   */
  getLayerVisiblilityClassName(layers: any[] | undefined) {
    const fallbackCls = 'fa fa-eye-slash all-layers-handle';
    if (!layers) {
      return fallbackCls;
    }
    const filteredLayers = layers.filter(this.props.treeNodeFilter!);
    if (!filteredLayers) {
      return fallbackCls;
    }
    const numLayers = filteredLayers.length;
    let visibleLayers = 0;
    filteredLayers.forEach(l => {
      if (l && l.getVisible() === true) {
        visibleLayers++;
      }
    });
    if (visibleLayers === 0) {
      return fallbackCls;
    }

    return visibleLayers === numLayers ? 'fa fa-eye all-layers-handle' : 'fa fa-eye some-layers all-layers-handle';
  }

  /**
   * Handler called when visiblity of all layers is changed
   *
   * @param {OlLayer[]} The OpenLayes layers to change visiblity for
   */
  onAllLayersVisibleChange(mapLayers: any[] | undefined) {
    if (!mapLayers) {
      return;
    }
    const filteredLayers = mapLayers.filter(this.props.treeNodeFilter!);
    const layerVisibilityClassName: string = this.getLayerVisiblilityClassName(mapLayers);
    let visibility = false;
    if (layerVisibilityClassName.indexOf('some-layers') > -1 ) {
      visibility = true;
    }
    if (layerVisibilityClassName.indexOf('fa-eye-slash') > -1) {
      visibility = true;
    }
    // update all layers
    filteredLayers.forEach(l => l.setVisible(visibility));

    // we need to do this since legend needs to be redrawn
    this.forceUpdate();
  }

  /**
   * Change handler for main layer legend accordion
   * @param {string[]} mainAccordionActiveKeys The panel keys which should be visible afterwards.
   */
  onLayerLegendAccordionChange(mainAccordionActiveKeys: string[]) {
    this.setState({ mainAccordionActiveKeys });
  }

  /**
   * Change handler for theme layers accordion.
   * @param {string[]} themeLayerActiveKeys The panel keys which should be visible afterwards.
   */
  onThemeLayerAccordionChange(themeLayerActiveKeys: string[]) {
    this.setState({ themeLayerActiveKeys });
  }

  /**
   * Change handler for base layers accordion.
   * @param {string[]} baseLayerActiveKeys The panel keys which should be visible afterwards.
   */
  onBaseLayerAccordionChange(baseLayerActiveKeys: string[]) {
    this.setState({ baseLayerActiveKeys });
  }

  /**
   * The render function
   */
  render() {
    const {
      map,
      mapLayers,
      t,
      onTopicLayerDragEnd
    } = this.props;

    const {
      mainAccordionActiveKeys,
      themeLayerActiveKeys,
      baseLayerActiveKeys
    } = this.state;

    const layerVisibilityClassName = this.getLayerVisiblilityClassName(mapLayers);
    const layerCollapsePanelCls = 'layer-collapse-panel';
    let finalLayerCollapsePanelCls = layerCollapsePanelCls;
    if (mapLayers && mapLayers.length) {
      finalLayerCollapsePanelCls = `${layerCollapsePanelCls} with-padding`;
    }

    return (
      <Collapse
        className="layer-legend-accordion"
        bordered={false}
        activeKey={mainAccordionActiveKeys}
        destroyInactivePanel={true}
        onChange={this.onLayerLegendAccordionChange}
      >
        <Panel
          header={
            <Titlebar className="layer-legend-accordion-title">
              <span>{t('LayerLegendAccordion.layerTreeTitle')}</span>
            </Titlebar>
          }
          key="tree"
          className="layerlist-collapse-panel"
        >
          {
            mapLayers && mapLayers.length > 0 &&
            <span
              className={layerVisibilityClassName}
              onClick={(event: React.MouseEvent) => {
                this.onAllLayersVisibleChange(mapLayers);
                event.preventDefault();
              }}
            >
              <span>{layerVisibilityClassName !== 'fa fa-eye all-layers-handle' ?
                t('LayerLegendAccordion.activateAllLayersText') :
                t('LayerLegendAccordion.deactivateAllLayersText')}
              </span>
            </span>
          }
          {
            this._mapLayerGroup.getLayers().getArray().length > 0 &&
            <Collapse
              bordered={false}
              destroyInactivePanel={true}
              activeKey={themeLayerActiveKeys}
              onChange={this.onThemeLayerAccordionChange}
            >
              <Panel
                header={t('LayerSetBaseMapChooser.topicText')}
                key="theme"
                className={finalLayerCollapsePanelCls}
              >
               <LayerTree
                 map={map}
                 layerGroup={this._mapLayerGroup}
                 nodeTitleRenderer={this.treeNodeTitleRenderer}
                 filterFunction={this.props.treeNodeFilter}
                 onDragEnd={onTopicLayerDragEnd}
               />
              </Panel>
           </Collapse>
          }
          {
            this._baseLayerGroup &&
            <Collapse
              bordered={false}
              destroyInactivePanel={true}
              activeKey={baseLayerActiveKeys}
              onChange={this.onBaseLayerAccordionChange}
            >
              <Panel
                header={t('LayerSetBaseMapChooser.baseLayerText')}
                key="base"
                className={layerCollapsePanelCls}
              >
                <LayerTree
                  map={map}
                  layerGroup={this._baseLayerGroup}
                  nodeTitleRenderer={this.treeNodeTitleRenderer}
                  draggable={false}
                />
              </Panel>
            </Collapse>
          }
        </Panel>
        <Panel
          header={
            <Titlebar className="layer-legend-accordion-title">
                <span>{t('LayerLegendAccordion.legendPanelTitle')}</span>
            </Titlebar>
          }
          key="legend"
          className="legend-collapse-panel"
        >
          {this.getLegendItems()}
        </Panel>
      </Collapse>
    );
  }
}