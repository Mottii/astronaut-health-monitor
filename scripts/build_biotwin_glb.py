#!/usr/bin/env python3
"""
Headless Blender Python pipeline (bpy) that compiles 24+ CC-BY 4.0 NIH / HuBMAP
Human Reference Atlas (Visible Human Male) .glb datasets + articulated axial
skeleton into a multi-layer clinical BioTwin scene:
    public/models/ares-biotwin.glb

Preserves translucent outer parenchyma (__Shell) separately from deep internal
anatomical trees (__Core) across all 6 aerospace physiology systems so internal
valves, bronchi, vasculature, ventricles, optic pathways, and renal pyramids
remain visible and raycast-inspectable at runtime.

Run via:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_biotwin_glb.py
"""

from __future__ import annotations

import math
import pathlib
import sys
import bpy
import bmesh
from mathutils import Matrix, Vector

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DIR = SCRIPT_DIR / "raw_organs"
OUT_GLB = PROJECT_ROOT / "public" / "models" / "ares-biotwin.glb"
OUT_GLB.parent.mkdir(parents=True, exist_ok=True)

# NIH Visible Human Male datasets already sit centered around (0, 0, 0) in Z-up
# meters (~-0.913m soles to +0.911m vertex). Zero offset preserves exact registration.
Z_OFFSET = 0.0

TISSUE_RGBA: dict[str, tuple[float, float, float, float]] = {
    "Shell": (0.06, 0.07, 0.09, 1.0),
    "Skeleton": (0.85, 0.83, 0.78, 1.0),
    "Cortex": (0.22, 0.74, 0.92, 1.0),
    "Ventricle": (0.14, 0.85, 0.93, 1.0),
    "Neural": (0.38, 0.65, 0.98, 1.0),
    "Ocular": (0.18, 0.84, 0.75, 1.0),
    "Endocrine": (0.51, 0.55, 0.97, 1.0),
    "Myocardium": (0.88, 0.14, 0.28, 1.0),
    "Valve": (0.95, 0.96, 0.98, 1.0),
    "Artery": (0.93, 0.24, 0.24, 1.0),
    "Vein": (0.24, 0.51, 0.94, 1.0),
    "Parenchyma": (0.75, 0.52, 0.98, 1.0),
    "Airway": (0.88, 0.91, 0.95, 1.0),
    "Lymphoid": (0.66, 0.33, 0.96, 1.0),
    "Hepatic": (0.84, 0.46, 0.08, 1.0),
    "Ligament": (0.94, 0.80, 0.35, 1.0),
    "Gland": (0.96, 0.62, 0.07, 1.0),
    "GI": (0.95, 0.54, 0.24, 1.0),
    "RenalCortex": (0.21, 0.83, 0.58, 1.0),
    "RenalMedulla": (0.94, 0.27, 0.42, 1.0),
    "Urinary": (0.12, 0.78, 0.54, 1.0),
    "Bone": (0.89, 0.88, 0.84, 1.0),
}


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def set_active_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def shade_smooth(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()


def clean_mesh(obj: bpy.types.Object) -> None:
    """Remove loose vertices/edges, recalculate outward normals, and validate mesh."""
    if obj.type != "MESH":
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for e in [edge for edge in bm.edges if not edge.link_faces]:
        bm.edges.remove(e)
    for v in [vert for vert in bm.verts if not vert.link_faces]:
        bm.verts.remove(v)
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate(verbose=False)
    obj.data.update()
    shade_smooth(obj)


def apply_decimate(obj: bpy.types.Object, target_faces: int) -> None:
    if obj.type != "MESH":
        return
    current_faces = len(obj.data.polygons)
    if current_faces > target_faces and current_faces > 0:
        ratio = max(0.015, min(1.0, target_faces / float(current_faces)))
        set_active_only(obj)
        mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    clean_mesh(obj)


def join_and_register(
    objs: list[bpy.types.Object],
    full_name: str,
    tissue_tag: str,
    target_faces: int,
) -> bpy.types.Object | None:
    """Join a bucket of sub-meshes, decimate conservatively, assign material, and clean."""
    mesh_objs = [o for o in objs if o is not None and o.type == "MESH" and len(o.data.vertices) > 0]
    if not mesh_objs:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = full_name
    if joined.data:
        joined.data.name = f"{full_name}_Mesh"
    set_active_only(joined)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    apply_decimate(joined, target_faces)
    assign_material(joined, f"Mat_{tissue_tag}", TISSUE_RGBA.get(tissue_tag, (0.8, 0.8, 0.8, 1.0)))
    return joined


def assign_material(obj: bpy.types.Object, mat_name: str, rgba: tuple[float, float, float, float]) -> None:
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.34
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def import_glb_meshes(filename: str, z_shift: float = Z_OFFSET) -> list[bpy.types.Object]:
    filepath = RAW_DIR / filename
    if not filepath.exists():
        return []
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    added = [o for o in bpy.data.objects if o not in before]
    mesh_objs = [o for o in added if o.type == "MESH" and len(o.data.vertices) > 0]
    for o in mesh_objs:
        world_mat = o.matrix_world.copy()
        o.parent = None
        if z_shift != 0.0:
            o.matrix_world = Matrix.Translation((0.0, 0.0, z_shift)) @ world_mat
        else:
            o.matrix_world = world_mat
        set_active_only(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in added:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    return mesh_objs


def create_curve_tube(
    name: str,
    points: list[tuple[float, float, float, float]],
    bevel_depth: float = 0.008,
    resolution_u: int = 8,
    bevel_res: int = 4,
    cyclic: bool = False,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = resolution_u
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = bevel_res
    curve_data.use_fill_caps = True

    spline = curve_data.splines.new(type="NURBS")
    spline.points.add(len(points) - 1)
    for idx, (x, y, z, r) in enumerate(points):
        spline.points[idx].co = (x, y, z + Z_OFFSET, 1.0)
        spline.points[idx].radius = r
    if cyclic:
        spline.use_cyclic_u = True
    else:
        spline.use_endpoint_u = True

    curve_obj = bpy.data.objects.new(name, curve_data)
    bpy.context.scene.collection.objects.link(curve_obj)
    set_active_only(curve_obj)
    bpy.ops.object.convert(target="MESH")
    mesh_obj = bpy.context.view_layer.objects.active
    shade_smooth(mesh_obj)
    return mesh_obj


def create_ellipsoid(
    name: str,
    center: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1.0,
        location=(center[0], center[1], center[2] + Z_OFFSET),
    )
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    shade_smooth(obj)
    return obj


def build_outer_body_shell() -> bpy.types.Object:
    """Use scanned NIH Visible Human Male skin.glb (~22k smooth tris) for Outer_Body_Shell."""
    skin_meshes = import_glb_meshes("skin.glb")
    if skin_meshes:
        shell = join_and_register(skin_meshes, "Outer_Body_Shell", "Shell", 22000)
        if shell:
            return shell

    # Emergency Metaball fallback if skin.glb wasn't available
    mball = bpy.data.metaballs.new("OuterBodyMB")
    mball.resolution = 0.015
    mb_obj = bpy.data.objects.new("Outer_Body_MB", mball)
    bpy.context.scene.collection.objects.link(mb_obj)
    el = mball.elements.new(type="ELLIPSOID")
    el.co = (0.0, 0.0, 0.0)
    el.radius = 0.22
    el.size_z = 3.8
    set_active_only(mb_obj)
    bpy.ops.object.convert(target="MESH")
    shell = bpy.context.view_layer.objects.active
    shell.name = "Outer_Body_Shell"
    apply_decimate(shell, 8000)
    assign_material(shell, "Mat_Shell", TISSUE_RGBA["Shell"])
    return shell


def build_skeletal_frame() -> bpy.types.Object:
    """
    Build articulated axial + upper-limb skeleton aligned strictly inside skin.glb:
    - Cranial contour arches & mandible guide (leaving brain/eyes unobstructed)
    - 24 cervical/thoracic/lumbar vertebral bodies + neural arch behind spinal_cord.glb
    - Sternum, bilateral clavicles, scapular spines & 12 pairs of thoracic ribs wrapping lung.glb
    - Bilateral A-pose humeri, radii & ulnae matching skin.glb arm vectors
    """
    parts: list[bpy.types.Object] = []

    # Subtle Cranial Calvaria Arches + Mandible (around brain z=0.75..0.90)
    parts.append(
        create_curve_tube(
            "SagittalArch",
            [
                (0.0, -0.095, 0.825, 0.9),
                (0.0, -0.072, 0.892, 1.0),
                (0.0, 0.005, 0.910, 1.0),
                (0.0, 0.088, 0.855, 1.0),
                (0.0, 0.082, 0.768, 0.9),
            ],
            bevel_depth=0.0038,
            bevel_res=2,
        )
    )
    parts.append(
        create_curve_tube(
            "CoronalArch",
            [
                (-0.076, -0.002, 0.805, 0.9),
                (-0.064, 0.000, 0.875, 1.0),
                (0.0, 0.002, 0.908, 1.0),
                (0.064, 0.000, 0.875, 1.0),
                (0.076, -0.002, 0.805, 0.9),
            ],
            bevel_depth=0.0034,
            bevel_res=2,
        )
    )
    parts.append(
        create_curve_tube(
            "MandibleArch",
            [
                (-0.062, -0.002, 0.780, 0.9),
                (-0.056, -0.025, 0.735, 1.0),
                (0.0, -0.096, 0.715, 1.1),
                (0.056, -0.025, 0.735, 1.0),
                (0.062, -0.002, 0.780, 0.9),
            ],
            bevel_depth=0.0055,
            bevel_res=2,
        )
    )

    # 24 Articulated Vertebrae C1..L5 posterior to spinal_cord.glb (y ~ 0.055..0.068)
    spine_pts: list[tuple[float, float, float, float]] = []
    for i in range(24):
        t = i / 23.0
        z = 0.755 - t * 0.595
        y = 0.055 + 0.016 * math.sin(t * math.pi * 2.15)
        r = 0.75 + 0.55 * t
        spine_pts.append((0.0, y, z, r))
        scale_xy = 0.014 + 0.009 * t
        parts.append(
            create_ellipsoid(
                f"VertebraBody_{i}",
                (0.0, y - 0.006, z),
                (scale_xy * 1.15, scale_xy * 0.9, 0.0085),
                subdivisions=1,
            )
        )
        # Dorsal spinous process
        parts.append(
            create_ellipsoid(
                f"SpinousProc_{i}",
                (0.0, y + 0.016, z - 0.004),
                (0.0045, 0.012, 0.005),
                subdivisions=1,
            )
        )
    parts.append(create_curve_tube("VertebralCanalAxis", spine_pts, bevel_depth=0.006, bevel_res=2))

    # Sternum (Manubrium, Gladiolus, Xiphoid) anterior to heart & trachea
    parts.append(
        create_curve_tube(
            "Sternum",
            [
                (0.0, -0.088, 0.625, 1.45),
                (0.0, -0.106, 0.535, 1.15),
                (0.0, -0.102, 0.435, 0.90),
            ],
            bevel_depth=0.009,
            bevel_res=3,
        )
    )

    # Bilateral Clavicles & Scapulae
    for side in (-1.0, 1.0):
        parts.append(
            create_curve_tube(
                f"Clavicle_{side}",
                [
                    (side * 0.018, -0.084, 0.635, 1.0),
                    (side * 0.095, -0.068, 0.652, 0.9),
                    (side * 0.190, -0.005, 0.620, 1.05),
                ],
                bevel_depth=0.0065,
                bevel_res=2,
            )
        )
        parts.append(
            create_curve_tube(
                f"ScapulaSpine_{side}",
                [
                    (side * 0.065, 0.102, 0.585, 0.8),
                    (side * 0.145, 0.082, 0.595, 1.0),
                    (side * 0.195, 0.025, 0.605, 0.9),
                ],
                bevel_depth=0.006,
                bevel_res=2,
            )
        )

    # 12 Pairs of Anatomical Thoracic Ribs wrapping cleanly outside lung.glb (max |x|=0.134)
    for r_idx in range(12):
        frac = r_idx / 11.0
        z_back = 0.625 - frac * 0.275
        z_front = z_back - (0.028 + 0.018 * frac)
        half_w = 0.098 + 0.062 * math.sin((0.18 + frac * 0.82) * math.pi * 0.82)
        y_back = 0.072 + 0.012 * math.sin(frac * math.pi)
        y_front = -0.096 - 0.012 * math.sin(frac * math.pi)
        anterior_x = 0.026 if r_idx < 7 else (0.045 + (r_idx - 7) * 0.020)
        for side in (-1.0, 1.0):
            rib_pts = [
                (side * 0.020, y_back - 0.008, z_back, 0.85),
                (side * (half_w * 0.72), y_back + 0.014, z_back - 0.008, 1.0),
                (side * half_w, -0.008, (z_back + z_front) * 0.5, 1.0),
                (side * (half_w * 0.68), y_front * 0.92, z_front, 0.95),
                (side * anterior_x, y_front, z_front + 0.012 * min(frac, 0.6), 0.8),
            ]
            parts.append(create_curve_tube(f"Rib_{r_idx}_{side}", rib_pts, bevel_depth=0.0044, bevel_res=2))

    # Bilateral A-Pose Humeri, Radii & Ulnae aligned directly along skin.glb arm centerlines
    for side in (-1.0, 1.0):
        parts.append(
            create_curve_tube(
                f"Humerus_{side}",
                [
                    (side * 0.205, 0.015, 0.575, 1.25),
                    (side * 0.258, 0.021, 0.420, 0.95),
                    (side * 0.311, 0.018, 0.265, 1.15),
                ],
                bevel_depth=0.012,
                bevel_res=2,
            )
        )
        parts.append(
            create_curve_tube(
                f"RadiusUlna_{side}",
                [
                    (side * 0.311, 0.018, 0.255, 1.1),
                    (side * 0.395, 0.004, 0.145, 0.88),
                    (side * 0.468, -0.014, 0.035, 0.95),
                ],
                bevel_depth=0.009,
                bevel_res=2,
            )
        )

    skel = join_and_register(parts, "Skeletal_Frame", "Skeleton", 15500)
    assert skel is not None
    return skel


def build_neuro_and_circadian() -> list[bpy.types.Object]:
    """
    Preserve layered sub-structures from brain.glb (283 nodes), eye_l/r.glb (46 nodes),
    and spinal_cord.glb (30 nodes) without collapsing cortex over deep nuclei/ventricles.
    """
    created: list[bpy.types.Object] = []

    brain_meshes = import_glb_meshes("brain.glb")
    eye_meshes = import_glb_meshes("eye_l.glb") + import_glb_meshes("eye_r.glb")
    cord_meshes = import_glb_meshes("spinal_cord.glb")

    buckets: dict[str, list[bpy.types.Object]] = {
        "pineal": [],
        "hth": [],
        "limbic": [],
        "prefrontal": [],
        "optic": [],
        "ventricles": [],
        "basal_thalamus": [],
        "cerebellum_stem": [],
        "cortex_shell": [],
    }

    for obj in brain_meshes:
        n = obj.name.lower()
        if any(k in n for k in ("pineal", "habenular")):
            buckets["pineal"].append(obj)
        elif any(k in n for k in ("hth", "hypothalamus", "mammill")):
            buckets["hth"].append(obj)
        elif any(k in n for k in ("amygdal", "hippocamp", "stria_terminalis", "subicul", "dentate", "parahippocamp")):
            buckets["limbic"].append(obj)
        elif any(k in n for k in ("frontal_pole", "frontomarginal", "rostral_gyrus", "cingulate_gyrus", "paracingulate")):
            buckets["prefrontal"].append(obj)
        elif any(k in n for k in ("optic_chiasm", "optic_tract", "optic_radiation", "lateral_geniculate")):
            buckets["optic"].append(obj)
        elif any(k in n for k in ("ventricle", "central_canal", "choroid", "aqueduct")):
            buckets["ventricles"].append(obj)
        elif any(
            k in n
            for k in (
                "thalam",
                "caudate",
                "putamen",
                "pallidus",
                "accumbens",
                "claustrum",
                "basal_forebrain",
                "septal",
                "callosum",
                "fornix",
                "commissure",
                "zona_incerta",
                "subthalamic",
                "white_matter",
            )
        ):
            buckets["basal_thalamus"].append(obj)
        elif any(
            k in n
            for k in (
                "cerebell",
                "vermis",
                "pons",
                "medulla",
                "midbrain",
                "tegmentum",
                "olive",
                "peduncle",
                "collicul",
                "substantia_nigra",
                "red_nucleus",
            )
        ):
            buckets["cerebellum_stem"].append(obj)
        else:
            buckets["cortex_shell"].append(obj)

    eye_shell: list[bpy.types.Object] = []
    eye_core: list[bpy.types.Object] = []
    for obj in eye_meshes:
        n = obj.name.lower()
        if any(k in n for k in ("sclera", "cornea", "conjunctiva")):
            eye_shell.append(obj)
        else:
            eye_core.append(obj)

    specs = [
        ("Organ_NeuroOcular__Shell__Cortex__Cerebral_Cortex_Gyri", buckets["cortex_shell"], "Cortex", 26000),
        ("Organ_NeuroOcular__Core__Ventricle__Cerebral_Ventricles_And_Choroid_Plexus", buckets["ventricles"], "Ventricle", 6500),
        ("Organ_NeuroOcular__Core__Neural__Thalamus_And_Basal_Ganglia", buckets["basal_thalamus"], "Neural", 11000),
        ("Organ_NeuroOcular__Core__Neural__Cerebellum_And_Brainstem", buckets["cerebellum_stem"], "Neural", 11000),
        ("Organ_NeuroOcular__Core__Ocular__Optic_Chiasm_And_Tracts", buckets["optic"], "Ocular", 3200),
        ("Organ_NeuroOcular__Shell__Ocular__Bilateral_Eye_Sclera_And_Cornea", eye_shell, "Ocular", 1800),
        ("Organ_NeuroOcular__Core__Ocular__Bilateral_Retina_Choroid_Lens_And_Optic_Nerve", eye_core, "Ocular", 3800),
        ("Organ_NeuroOcular__Core__Neural__Spinal_Cord_And_Nerve_Roots", cord_meshes, "Neural", 7500),
        ("Organ_BehavioralCircadian__Core__Endocrine__Pineal_Gland_And_Epithalamus", buckets["pineal"], "Endocrine", 1200),
        ("Organ_BehavioralCircadian__Core__Neural__Hypothalamic_Suprachiasmatic_Complex", buckets["hth"], "Neural", 2400),
        ("Organ_BehavioralCircadian__Core__Neural__Limbic_Amygdala_And_Hippocampus", buckets["limbic"], "Neural", 4200),
        ("Organ_BehavioralCircadian__Core__Neural__Prefrontal_And_Cingulate_Cortex", buckets["prefrontal"], "Endocrine", 7500),
    ]
    for name, objs, tag, budget in specs:
        res = join_and_register(objs, name, tag, budget)
        if res:
            created.append(res)
    return created


def build_cardiovascular() -> list[bpy.types.Object]:
    """
    Separate cardiac chambers (__Shell) from valves, septum, papillary muscles (__Core),
    and classify the 106 scanned systemic vessels from blood_vasculature.glb into Artery vs. Vein.
    """
    created: list[bpy.types.Object] = []
    heart_meshes = import_glb_meshes("heart.glb")
    vasc_meshes = import_glb_meshes("blood_vasculature.glb")

    atria: list[bpy.types.Object] = []
    ventricles: list[bpy.types.Object] = []
    valves: list[bpy.types.Object] = []
    septum_pap: list[bpy.types.Object] = []

    for obj in heart_meshes:
        n = obj.name.lower()
        if "valve" in n:
            valves.append(obj)
        elif "septum" in n or "papillary" in n:
            septum_pap.append(obj)
        elif "atrium" in n:
            atria.append(obj)
        else:
            ventricles.append(obj)

    arteries: list[bpy.types.Object] = []
    veins: list[bpy.types.Object] = []
    for obj in vasc_meshes:
        n = obj.name.lower()
        if any(k in n for k in ("vein", "vena_cava", "sinus")):
            veins.append(obj)
        else:
            arteries.append(obj)

    specs = [
        ("Organ_Cardiovascular__Shell__Myocardium__Left_And_Right_Cardiac_Atria", atria, "Myocardium", 7500),
        ("Organ_Cardiovascular__Shell__Myocardium__Left_And_Right_Cardiac_Ventricles", ventricles, "Myocardium", 8000),
        ("Organ_Cardiovascular__Core__Valve__Mitral_Tricuspid_Aortic_And_Pulmonary_Valves", valves, "Valve", 6500),
        ("Organ_Cardiovascular__Core__Myocardium__Interventricular_Septum_And_Papillary_Muscles", septum_pap, "Myocardium", 4500),
        ("Organ_Cardiovascular__Core__Artery__Systemic_Arterial_Tree", arteries, "Artery", 22000),
        ("Organ_Cardiovascular__Core__Vein__Systemic_Venous_Tree", veins, "Vein", 20000),
    ]
    for name, objs, tag, budget in specs:
        res = join_and_register(objs, name, tag, budget)
        if res:
            created.append(res)
    return created


def build_immune_hematology() -> list[bpy.types.Object]:
    """
    Separate outer left/right bronchopulmonary lung segments (__Shell) from the internal
    trachea, main/lobar/segmental/tertiary bronchial tree, thymus, spleen, and lymphatics (__Core).
    """
    created: list[bpy.types.Object] = []
    lung_meshes = import_glb_meshes("lung.glb")
    trachea_meshes = import_glb_meshes("trachea.glb") + import_glb_meshes("main_bronchus.glb")
    thymus_meshes = import_glb_meshes("thymus.glb")
    spleen_meshes = import_glb_meshes("spleen.glb")
    lymph_meshes = import_glb_meshes("lymph_node.glb")

    left_lobes: list[bpy.types.Object] = []
    right_lobes: list[bpy.types.Object] = []
    inner_bronchi: list[bpy.types.Object] = []

    for obj in lung_meshes:
        n = obj.name.lower()
        if "bronchopulmonary_segment" in n:
            if "left" in n:
                left_lobes.append(obj)
            else:
                right_lobes.append(obj)
        elif n == "vh_m_bronchus":
            trachea_meshes.append(obj)
        else:
            inner_bronchi.append(obj)

    # Synthesize architectural Thoracic Lymphatic Duct + Axillary/Cervical/Inguinal Lymph Nodes
    # only if lymph_node.glb could not be downloaded
    if not lymph_meshes:
        lymph_meshes.append(
            create_curve_tube(
                "ThoracicLymphaticDuct",
                [
                    (-0.022, -0.025, 0.590, 0.8),
                    (0.008, 0.015, 0.540, 0.9),
                    (0.010, 0.022, 0.340, 1.0),
                    (0.006, 0.018, 0.240, 1.4),
                ],
                bevel_depth=0.0032,
                bevel_res=2,
            )
        )
        node_coords = [
            (0.042, -0.012, 0.640), (-0.042, -0.012, 0.640),  # Cervical
            (0.145, -0.015, 0.545), (-0.145, -0.015, 0.545),  # Axillary
            (0.025, -0.018, 0.515), (-0.022, -0.018, 0.515),  # Mediastinal
            (0.092, -0.032, 0.065), (-0.092, -0.032, 0.065),  # Inguinal
        ]
        for idx, nc in enumerate(node_coords):
            lymph_meshes.append(create_ellipsoid(f"LymphNode_{idx}", nc, (0.007, 0.0055, 0.0095), subdivisions=1))

    specs = [
        ("Organ_ImmuneHematology__Shell__Parenchyma__Left_Lung_Bronchopulmonary_Lobes", left_lobes, "Parenchyma", 5500),
        ("Organ_ImmuneHematology__Shell__Parenchyma__Right_Lung_Bronchopulmonary_Lobes", right_lobes, "Parenchyma", 5500),
        ("Organ_ImmuneHematology__Core__Airway__Trachea_And_Main_Bronchi", trachea_meshes, "Airway", 9500),
        ("Organ_ImmuneHematology__Core__Airway__Intrapulmonary_Bronchial_Tree_And_Cartilage", inner_bronchi, "Airway", 19000),
        ("Organ_ImmuneHematology__Core__Lymphoid__Mediastinal_Thymus_Gland", thymus_meshes, "Lymphoid", 2730),
        ("Organ_ImmuneHematology__Core__Lymphoid__Spleen_Parenchyma_And_Hilum", spleen_meshes, "Lymphoid", 6500),
        ("Organ_ImmuneHematology__Core__Lymphoid__Systemic_Lymphatic_Network", lymph_meshes, "Lymphoid", 4000),
    ]
    for name, objs, tag, budget in specs:
        res = join_and_register(objs, name, tag, budget)
        if res:
            created.append(res)
    return created


def build_metabolic_endocrine() -> list[bpy.types.Object]:
    """
    Combine liver segments (__Shell), porta hepatis/caudate/quadrate lobes (__Core),
    hepatic ligaments (__Core), pancreas (__Core), small intestine (__Core), and colon (__Shell).
    """
    created: list[bpy.types.Object] = []
    liver_meshes = import_glb_meshes("liver.glb")
    pancreas_meshes = import_glb_meshes("pancreas.glb")
    small_meshes = import_glb_meshes("small_intestine.glb")
    large_meshes = import_glb_meshes("large_intestine.glb")

    liver_shell: list[bpy.types.Object] = []
    liver_core: list[bpy.types.Object] = []
    liver_ligaments: list[bpy.types.Object] = []

    for obj in liver_meshes:
        n = obj.name.lower()
        if "ligament" in n:
            liver_ligaments.append(obj)
        elif any(k in n for k in ("caudate", "quadrate", "porta_hepatis", "bare_area", "impression")):
            liver_core.append(obj)
        else:
            liver_shell.append(obj)

    specs = [
        ("Organ_MetabolicEndocrine__Shell__Hepatic__Hepatic_Parenchyma_Segments", liver_shell, "Hepatic", 11000),
        ("Organ_MetabolicEndocrine__Core__Hepatic__Caudate_Quadrate_Lobes_And_Porta_Hepatis", liver_core, "Hepatic", 5500),
        ("Organ_MetabolicEndocrine__Core__Ligament__Hepatic_Falciform_And_Coronary_Ligaments", liver_ligaments, "Ligament", 2500),
        ("Organ_MetabolicEndocrine__Core__Gland__Pancreas_Head_Neck_Body_And_Tail", pancreas_meshes, "Gland", 9500),
        ("Organ_MetabolicEndocrine__Core__GI__Small_Intestine_Duodenum_Jejunum_Ileum", small_meshes, "GI", 12000),
        ("Organ_MetabolicEndocrine__Shell__GI__Large_Intestine_Colon_Tract", large_meshes, "GI", 12000),
    ]
    for name, objs, tag, budget in specs:
        res = join_and_register(objs, name, tag, budget)
        if res:
            created.append(res)
    return created


def build_musculoskeletal_renal() -> list[bpy.types.Object]:
    """
    Separate outer renal cortex/capsule (__Shell) from internal renal columns, medullary
    pyramids, papillae, ureters, urinary bladder, scanned bony pelvis, and knee femur/tibia complexes.
    """
    created: list[bpy.types.Object] = []
    kidney_meshes = import_glb_meshes("kidney_l.glb") + import_glb_meshes("kidney_r.glb")
    ureter_meshes = import_glb_meshes("ureter_l.glb") + import_glb_meshes("ureter_r.glb")
    bladder_meshes = import_glb_meshes("urinary_bladder.glb")
    pelvis_meshes = import_glb_meshes("pelvis.glb")
    knee_meshes = import_glb_meshes("knee_l.glb") + import_glb_meshes("knee_r.glb")

    renal_shell: list[bpy.types.Object] = []
    renal_core: list[bpy.types.Object] = []
    for obj in kidney_meshes:
        n = obj.name.lower()
        if "capsule" in n or "outer_cortex" in n:
            renal_shell.append(obj)
        else:
            renal_core.append(obj)

    specs = [
        ("Organ_MusculoskeletalRenal__Shell__RenalCortex__Left_And_Right_Renal_Cortex_And_Capsule", renal_shell, "RenalCortex", 9500),
        ("Organ_MusculoskeletalRenal__Core__RenalMedulla__Left_And_Right_Renal_Pyramids_Columns_And_Papillae", renal_core, "RenalMedulla", 14000),
        ("Organ_MusculoskeletalRenal__Core__Urinary__Bilateral_Renal_Calyces_And_Ureters", ureter_meshes, "Urinary", 12000),
        ("Organ_MusculoskeletalRenal__Core__Urinary__Urinary_Bladder_And_Trigone", bladder_meshes, "Urinary", 5500),
        ("Organ_MusculoskeletalRenal__Core__Bone__Bony_Pelvis_And_Sacroiliac_Joints", pelvis_meshes, "Bone", 16000),
        ("Organ_MusculoskeletalRenal__Core__Bone__Bilateral_Knee_Articular_Complex", knee_meshes, "Bone", 16000),
    ]
    for name, objs, tag, budget in specs:
        res = join_and_register(objs, name, tag, budget)
        if res:
            created.append(res)
    return created


def main() -> int:
    clear_scene()
    col = bpy.data.collections.new("ARES_BioTwin")
    bpy.context.scene.collection.children.link(col)

    print("[1/7] Loading Outer_Body_Shell (Visible Human Male skin.glb)...")
    shell = build_outer_body_shell()

    print("[2/7] Building articulated Skeletal_Frame...")
    skel = build_skeletal_frame()

    print("[3/7] Compiling NeuroOcular & BehavioralCircadian layers...")
    neuro_objs = build_neuro_and_circadian()

    print("[4/7] Compiling Cardiovascular layers & systemic Blood Vasculature...")
    cardio_objs = build_cardiovascular()

    print("[5/7] Compiling ImmuneHematology layers (Lung Parenchyma + Bronchial Tree + Thymus + Spleen + Lymphatics)...")
    immune_objs = build_immune_hematology()

    print("[6/7] Compiling MetabolicEndocrine layers (Liver + Pancreas + Small/Large Intestines)...")
    meta_objs = build_metabolic_endocrine()

    print("[7/7] Compiling MusculoskeletalRenal layers (Renal Cortex/Pyramids + Ureters + Bladder + Pelvis + Knees)...")
    renal_objs = build_musculoskeletal_renal()

    all_objects = [shell, skel, *neuro_objs, *cardio_objs, *immune_objs, *meta_objs, *renal_objs]
    total_verts = 0
    total_faces = 0
    print(f"\nScene summary ({len(all_objects)} anatomical nodes):")
    for obj in all_objects:
        if obj.type != "MESH":
            continue
        clean_mesh(obj)
        v_cnt = len(obj.data.vertices)
        f_cnt = len(obj.data.polygons)
        total_verts += v_cnt
        total_faces += f_cnt
        coords = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
        min_b = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
        max_b = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
        ctr = (min_b + max_b) * 0.5
        print(
            f"  -> {obj.name}: {f_cnt:6d} faces | "
            f"gltf_ctr=({ctr.x:+.3f}, {ctr.z:+.3f}, {-ctr.y:+.3f})"
        )

    print(f"\nTotal exported topology: {total_verts:,} verts, {total_faces:,} faces")
    print(f"Exporting GLB -> {OUT_GLB}...")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_materials="EXPORT",
    )
    size_mb = OUT_GLB.stat().st_size / (1024 * 1024)
    print(f"Export complete: {OUT_GLB} ({size_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
