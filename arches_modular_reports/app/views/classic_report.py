"""The classic (Knockout) report of a resource whose graph uses the modular report.

The classic report page fetches its data from api/resource_report/<id>, which
takes the template from the published graph. For a modular graph that is the
modular template (preload_resource_data false), so the page would get no data
and stay blank. This route is core's, with the template fixed to the classic
default; /report/<id>?view=classic points the page at it.
"""

import json
import uuid

from django.utils.translation import get_language

from arches.app.models import models
from arches.app.models.graph import Graph
from arches.app.models.resource import Resource
from arches.app.models.system_settings import settings
from arches.app.utils.permission_backend import (
    get_nodegroups_by_perm,
    user_can_read_resource,
)
from arches.app.utils.response import JSONResponse
from arches.app.views.api.resource import ResourceReport
from arches.app.views.resource import RelatedResourcesView

# "No Header Template", core's default report template.
CLASSIC_TEMPLATE_ID = "50000000-0000-0000-0000-000000000001"


class ClassicResourceReport(ResourceReport):
    # Core's ResourceReport.get (Arches 8.1.5) with one line changed, the
    # template. tests/test_classic_view.py fails when core's get changes.
    def get(self, request, resourceid):
        if not user_can_read_resource(user=request.user, resourceid=resourceid):
            return JSONResponse(status=403)

        exclude = request.GET.get("exclude", [])
        uncompacted_value = request.GET.get("uncompacted")
        version = request.GET.get("v")
        compact = True
        if uncompacted_value == "true":
            compact = False
        perm = "read_nodegroup"

        resource = Resource.objects.get(pk=resourceid)
        published_graph = models.PublishedGraph.objects.get(
            publication=resource.graph_publication, language=get_language()
        )
        graph = Graph(published_graph.serialized_graph)
        template = models.ReportTemplate.objects.get(pk=CLASSIC_TEMPLATE_ID)
        graph_has_different_publication = bool(
            resource.graph.publication_id != published_graph.publication_id
        )

        # if a user is viewing a report for a resource that does not have the same publication as the current graph publication
        # ( and therefore is out-of-date ) only allow them to access report details if they have Graph Editor permissions or higher.
        if (
            graph_has_different_publication
            and not request.user.groups.filter(
                name__in=[
                    "Graph Editor",
                    "RDM Administrator",
                    "Application Administrator",
                    "System Administrator",
                ]
            ).exists()
        ):
            return JSONResponse(
                {
                    "displayname": resource.displayname(),
                    "resourceid": resourceid,
                    "hide_empty_nodes": settings.HIDE_EMPTY_NODES_IN_REPORT,
                    "template": template,
                    "graph": graph,
                }
            )

        if not template.preload_resource_data:
            return JSONResponse(
                {
                    "template": template,
                    "report_json": resource.to_json(
                        compact=compact, version=version, user=request.user, perm=perm
                    ),
                }
            )

        resp = {
            "datatypes": models.DDataType.objects.all(),
            "displayname": resource.displayname(),
            "resourceid": resourceid,
            "graph": graph,
            "hide_empty_nodes": settings.HIDE_EMPTY_NODES_IN_REPORT,
            # "report_json": resource.to_json(compact=compact, version=version),
        }

        if "template" not in exclude:
            resp["template"] = template

        if "related_resources" not in exclude:
            resource_models = (
                models.GraphModel.objects.filter(isresource=True)
                .exclude(is_active=False)
                .exclude(pk=settings.SYSTEM_SETTINGS_RESOURCE_MODEL_ID)
                .exclude(source_identifier__isnull=False)
            )

            get_params = request.GET.copy()
            get_params.update({"paginate": "false"})
            request.GET = get_params

            related_resources_response = RelatedResourcesView().get(
                request, resourceid, include_rr_count=False, graphs=resource_models
            )
            related_resources = json.loads(related_resources_response.content)

            related_resources_summary = self._generate_related_resources_summary(
                related_resources=related_resources["related_resources"],
                resource_relationships=related_resources["resource_relationships"],
                resource_models=resource_models,
            )

            resp["related_resources"] = related_resources_summary

        if "tiles" not in exclude:
            resource.load_tiles(user=request.user, perm=perm)
            permitted_tiles = resource.tiles

            resp["tiles"] = permitted_tiles

        if "cards" not in exclude:
            readable_nodegroup_ids = [
                nodegroup_id
                for nodegroup_id in get_nodegroups_by_perm(
                    request.user, perm, any_perm=True
                )
            ]
            writable_nodegroup_ids = [
                nodegroup_id
                for nodegroup_id in get_nodegroups_by_perm(
                    request.user,
                    "write_nodegroup",
                    any_perm=True,
                )
            ]

            permitted_cards = sorted(
                [
                    card
                    for card in graph.cards.values()
                    if card.nodegroup_id in readable_nodegroup_ids
                    or card.nodegroup_id in writable_nodegroup_ids
                ],
                key=lambda card: card.sortorder or 0,
            )

            permitted_card_ids = [card.pk for card in permitted_cards]
            cardwidgets = sorted(
                [
                    card_node_widget
                    for card_node_widget in graph.cards_x_nodes_x_widgets
                    if uuid.UUID(card_node_widget["card_id"]) in permitted_card_ids
                ],
                key=lambda card_node_widget: card_node_widget["sortorder"] or 0,
            )

            resp["cards"] = permitted_cards
            resp["cardwidgets"] = cardwidgets

        return JSONResponse(resp)
