/**
 * Copyright (c) 2011-2018 by Andrew Mustun. All rights reserved.
 * 
 * This file is part of the QCAD project.
 *
 * QCAD is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * QCAD is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with QCAD.
 */

include("../Dimension.js");

/**
 * \class DimAngular
 * \brief Draw angular dimension.
 * The first entity is a line or arc. If the first entity is a line,
 * a second entity has to be chosen which is also a line.
 * If using max angle, this action creates a 3 point angular dimension.
 * \ingroup ecma_draw_dimension
 */
function DimAngular(guiAction) {
    Dimension.call(this, guiAction);

    this.data2L = new RDimAngular2LData();
    this.data3P = new RDimAngular3PData();
    this.firstEntity = undefined;
    this.firstShape = undefined;
    this.secondEntity = undefined;
    this.secondShape = undefined;
    this.useMaxAngle = false;
    this.setUiOptions(["../Dimension.ui", "DimAngular.ui"], false);
}

DimAngular.prototype = new Dimension();

DimAngular.State = {
    SettingFirstEntity : 0,
    SettingSecondEntity : 1,
    SettingDimPos : 2
};

DimAngular.prototype.beginEvent = function() {
    Dimension.prototype.beginEvent.call(this);

    this.setState(DimAngular.State.SettingFirstEntity);
};

DimAngular.prototype.setState = function(state) {
    Dimension.prototype.setState.call(this, state);

    this.setCrosshairCursor();

    var appWin = RMainWindowQt.getMainWindow();
    switch (this.state) {
    case DimAngular.State.SettingFirstEntity:
        this.getDocumentInterface().setClickMode(RAction.PickEntity);
        this.data2L.setExtensionLine1Start(RVector.invalid);
        this.data2L.setExtensionLine1End(RVector.invalid);
        this.data2L.setExtensionLine2Start(RVector.invalid);
        this.data2L.setExtensionLine2End(RVector.invalid);
        this.data2L.setDimArcPosition(RVector.invalid);
        this.firstEntity = undefined;
        this.firstShape = undefined;
        this.secondEntity = undefined;
        this.secondShape = undefined;
        var trFirstEntity = qsTr("Arc or first of two lines");
        this.setLeftMouseTip(trFirstEntity);
        this.setRightMouseTip(EAction.trCancel);
        break;

    case DimAngular.State.SettingSecondEntity:
        this.getDocumentInterface().setClickMode(RAction.PickEntity);
        this.data2L.setExtensionLine2Start(RVector.invalid);
        this.data2L.setExtensionLine2End(RVector.invalid);
        this.data2L.setDimArcPosition(RVector.invalid);
        this.secondEntity = undefined;
        this.secondShape = undefined;
        var trSecondEntity = qsTr("Second line");
        this.setLeftMouseTip(trSecondEntity);
        this.setRightMouseTip(EAction.trBack);
        break;

    case DimAngular.State.SettingDimPos:
        this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
        this.data2L.setDefinitionPoint(RVector.invalid);
        var trDimPos = qsTr("Dimension arc location");
        this.setCommandPrompt(trDimPos);
        this.setLeftMouseTip(trDimPos);
        this.setRightMouseTip(EAction.trBack);
        break;
    }

    EAction.showSnapTools();
};

DimAngular.prototype.escapeEvent = function() {
    switch (this.state) {
    case DimAngular.State.SettingFirstEntity:
        EAction.prototype.escapeEvent.call(this);
        break;

    case DimAngular.State.SettingSecondEntity:
        this.setState(DimAngular.State.SettingFirstEntity);
        break;

    case DimAngular.State.SettingDimPos:
        if (isArcShape(this.firstShape)) {
            this.setState(DimAngular.State.SettingFirstEntity);
        }
        else {
            this.setState(DimAngular.State.SettingSecondEntity);
        }
        break;
    }
};

DimAngular.prototype.pickEntity = function(event, preview) {
    var shape, appWin;
    
    var di = this.getDocumentInterface();
    var doc = this.getDocument();
    var entityId = this.getEntityId(event, preview);
    var entity = doc.queryEntity(entityId);
    var pos = event.getModelPosition();

    if (isNull(entity)) {
        return;
    }

    switch (this.state) {
    case DimAngular.State.SettingFirstEntity:
        shape = entity.getClosestSimpleShape(pos);

        if (isLineBasedShape(shape)) {
            this.firstEntity = entity;
            this.firstShape = shape;
            if (preview) {
                this.updatePreview();
            }
            else {
                this.setState(DimAngular.State.SettingSecondEntity);
            }
        }
        else if (isArcShape(shape)) {
            this.firstEntity = entity;
            this.firstShape = shape;
            if (preview) {
                this.updatePreview();
            }
            else {
                this.setState(DimAngular.State.SettingDimPos);
            }
        } else {
            if (!preview) {
                EAction.warnNotLineOrArc();
                break;
            }
        }
        break;

    case DimAngular.State.SettingSecondEntity:
        shape = entity.getClosestSimpleShape(pos);

        if (isLineBasedShape(shape)) {
            this.secondEntity = entity;
            this.secondShape = shape;
            if (preview) {
                this.updatePreview();
            }
            else {
                this.setState(DimAngular.State.SettingDimPos);
            }
        }
        else {
            if (!preview) {
                EAction.warnNotLine();
                break;
            }
        }
        break;
    }
};

DimAngular.prototype.pickCoordinate = function(event, preview) {
    var di = this.getDocumentInterface();

    switch (this.state) {
    case DimAngular.State.SettingDimPos:
        this.data2L.setDimArcPosition(event.getModelPosition());
        if (preview) {
            this.updatePreview();
        }
        else {
            var op = this.getOperation(false);
            if (!isNull(op)) {
                di.applyOperation(op);
                this.setState(DimAngular.State.SettingFirstEntity);
            }
        }
        break;

    }
};

DimAngular.prototype.getOperation = function(preview) {
    if (!isLineBasedShape(this.firstShape) && !isArcShape(this.firstShape)) {
        return undefined;
    }

    if (isLineBasedShape(this.firstShape) && !isLineBasedShape(this.secondShape)) {
        return undefined;
    }

    var di = this.getDocumentInterface();

    if (isLineBasedShape(this.firstShape)) {
        var intersections = this.firstShape.getIntersectionPoints(this.secondShape.data(), false);

        if (intersections.length!==1) {
            return undefined;
        }

        var center = intersections[0];

        if (this.useMaxAngle) {
            this.data3P.setCenter(center);
            this.data3P.setDimArcPosition(this.data2L.getDimArcPosition());
            if (center.getDistanceTo(this.firstShape.getStartPoint()) <
                center.getDistanceTo(this.firstShape.getEndPoint())) {
                this.data3P.setExtensionLine1End(this.firstShape.getEndPoint());
            }
            else {
                this.data3P.setExtensionLine1End(this.firstShape.getStartPoint());
            }
            if (center.getDistanceTo(this.secondShape.getStartPoint()) <
                center.getDistanceTo(this.secondShape.getEndPoint())) {
                this.data3P.setExtensionLine2End(this.secondShape.getEndPoint());
            }
            else {
                this.data3P.setExtensionLine2End(this.secondShape.getStartPoint());
            }
        }

        else {
            if (center.getDistanceTo(this.firstShape.getStartPoint()) <
                center.getDistanceTo(this.firstShape.getEndPoint())) {
                this.data2L.setExtensionLine1Start(this.firstShape.getEndPoint());
                this.data2L.setExtensionLine1End(this.firstShape.getStartPoint());
            } else {
                this.data2L.setExtensionLine1Start(this.firstShape.getStartPoint());
                this.data2L.setExtensionLine1End(this.firstShape.getEndPoint());
            }

            if (center.getDistanceTo(this.secondShape.getStartPoint()) <
                center.getDistanceTo(this.secondShape.getEndPoint())) {
                this.data2L.setExtensionLine2Start(this.secondShape.getStartPoint());
                this.data2L.setExtensionLine2End(this.secondShape.getEndPoint());
            } else {
                this.data2L.setExtensionLine2Start(this.secondShape.getEndPoint());
                this.data2L.setExtensionLine2End(this.secondShape.getStartPoint());
            }
            if (!preview) {
                di.setRelativeZero(center);
            }
        }

        //var ang = center.getAngleTo(this.data2L.getDimArcPosition());

        //qDebug("useMaxAngle:", this.useMaxAngle);

//        if (this.useMaxAngle) {
//            if (center.getDistanceTo(this.firstShape.getStartPoint()) <
//                center.getDistanceTo(this.firstShape.getEndPoint())) {

//                this.data2L.setExtensionLine1Start(this.firstShape.getStartPoint());
//                this.data2L.setExtensionLine1End(this.firstShape.getEndPoint());
//            } else {
//                this.data2L.setExtensionLine1Start(this.firstShape.getEndPoint());
//                this.data2L.setExtensionLine1End(this.firstShape.getStartPoint());
//            }

//            if (center.getDistanceTo(this.secondShape.getStartPoint()) <
//                center.getDistanceTo(this.secondShape.getEndPoint())) {

//                this.data2L.setExtensionLine2Start(this.secondShape.getStartPoint());
//                this.data2L.setExtensionLine2End(this.secondShape.getEndPoint());
//            } else {
//                this.data2L.setExtensionLine2Start(this.secondShape.getEndPoint());
//                this.data2L.setExtensionLine2End(this.secondShape.getStartPoint());
//            }
//        }
//        else {

//            // find out the angles this dimension refers to:
//            var done = false;
//            //var ang1 = this.data2L.setExtensionLine1Start.getAngleTo(this.data2L.setExtensionLine1End);
//            var ang1;
//            for (var f1=0; f1<=1 && !done; ++f1) {
//                //ang1 = RMath.getNormalizedAngle(this.data2L.setExtensionLine1End.getAngleTo(this.data2L.setExtensionLine1Start) + f1*Math.PI);
//                if (f1===0) {
//                    this.data2L.setExtensionLine1Start(this.firstShape.getStartPoint());
//                    this.data2L.setExtensionLine1End(this.firstShape.getEndPoint());
//                    ang1 = this.firstShape.getDirection1();
//                }
//                else {
//                    this.data2L.setExtensionLine1Start(this.firstShape.getEndPoint());
//                    this.data2L.setExtensionLine1End(this.firstShape.getStartPoint());
//                    ang1 = this.firstShape.getDirection2();
//                }

//    //            if (f1==0) {
//    //                p1 = this.data2L.setExtensionLine1Start;
//    //            } else {
//    //                p1 = this.data2L.setExtensionLine1End;
//    //            }
//                var ang2;
//                for (var f2=0; f2<=1 && !done; ++f2) {
//                    //ang2 = RMath.getNormalizedAngle(this.data2L.setExtensionLine2Start.getAngleTo(this.data2L.setExtensionLine2End) + f2*Math.PI);
//                    if (f2===0) {
//                        this.data2L.setExtensionLine2Start(this.secondShape.getStartPoint());
//                        this.data2L.setExtensionLine2End(this.secondShape.getEndPoint());
//                        ang2 = this.secondShape.getDirection1();
//                    }
//                    else {
//                        this.data2L.setExtensionLine2Start(this.secondShape.getEndPoint());
//                        this.data2L.setExtensionLine2End(this.secondShape.getStartPoint());
//                        ang2 = this.secondShape.getDirection2();
//                    }
//                    //if (f2==0) {
//                    //    p2 = definitionPoint;
//                    //} else {
//                    //    p2 = extensionLine2Start;
//                    //}
//                    for (var t=0; t<=1 && !done; ++t) {
//                        var reversed = (t===1);

//                        var angDiff;

//                        if (!reversed) {
//                            if (ang2<ang1) {
//                                ang2+=2*Math.PI;
//                            }
//                            angDiff = ang2-ang1;
//                        } else {
//                            if (ang1<ang2) {
//                                ang1+=2*Math.PI;
//                            }
//                            angDiff = ang1-ang2;
//                        }

//                        ang1 = RMath.getNormalizedAngle(ang1);
//                        ang2 = RMath.getNormalizedAngle(ang2);

//                        if (RMath.isAngleBetween(ang, ang1, ang2, reversed) && angDiff<=Math.PI) {
//                            done = true;
//                            break;
//                        }
//                    }
//                }
//            }
//        }

//        qDebug("ang1:", ang1);
//        qDebug("ang2:", ang2);
//        qDebug("reversed:", reversed);

//        if (reversed) {
            // TODO:
            // reverse extension line 1 and 2:
//        }


        if (!preview) {
            di.setRelativeZero(center);
        }
    }

    if (isArcShape(this.firstShape)) {
        this.data2L.setExtensionLine1Start(this.firstShape.getCenter());
        this.data2L.setExtensionLine1End(this.firstShape.getStartPoint());
        this.data2L.setExtensionLine2Start(this.firstShape.getCenter());
        this.data2L.setExtensionLine2End(this.firstShape.getEndPoint());
    }


    var doc = this.getDocument();
    var entity;
    if (this.useMaxAngle) {
        if (!this.data3P.isValid()) {
            return undefined;
        }
        entity = new RDimAngular3PEntity(doc, this.data3P);
    }
    else {
        if (!this.data2L.isValid()) {
            return undefined;
        }
        entity = new RDimAngular2LEntity(doc, this.data2L);
    }

    if (!isEntity(entity)) {
        return undefined;
    }

    return new RAddObjectOperation(entity, this.getToolTitle());
};

DimAngular.prototype.getHighlightedEntities = function() {
    var ret = [];
    if (isEntity(this.firstEntity)) {
        ret.push(this.firstEntity.getId());
    }
    if (isEntity(this.secondEntity)) {
        ret.push(this.secondEntity.getId());
    }
    return ret;
};

DimAngular.prototype.slotUseMaxAngleChanged = function(v) {
    this.useMaxAngle = v;
};
